# Safe, single-function Firebase rollback helper.
# This script is intentionally not a deployment or source restore mechanism.
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('staging', 'production')]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z][A-Za-z0-9_-]{0,62}$')]
    [string]$FunctionName,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ProjectId
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'firebase-project-guard.ps1')

function Invoke-RollbackFirebase {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    $output = & firebase @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Firebase CLI failed ($LASTEXITCODE): $($Arguments -join ' ')`n$($output -join "`n")" }
    return ,$output
}

function Invoke-RollbackGcloud {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    $output = & gcloud @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "gcloud failed ($LASTEXITCODE): $($Arguments -join ' ')`n$($output -join "`n")" }
    return ,$output
}

function Get-RollbackFunctionNames {
    param([Parameter(Mandatory = $true)][string]$ValidatedProjectId)
    $raw = Invoke-RollbackFirebase -Arguments @('functions:list', '--json', '--project', $ValidatedProjectId)
    try { $items = ($raw -join "`n") | ConvertFrom-Json -ErrorAction Stop }
    catch { throw 'Firebase function inventory was not valid JSON; refusing to continue.' }
    return @($items | ForEach-Object { [string]$_.id } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Test-RollbackBucketPermissions {
    param([Parameter(Mandatory = $true)][string]$BucketName)
    $token = (& gcloud auth print-access-token 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) { throw 'Unable to obtain an access token for bucket permission preflight.' }
    $bucketPath = [Uri]::EscapeDataString($BucketName)
    $permissions = @('storage.objects.create', 'storage.objects.get', 'storage.objects.list')
    $query = ($permissions | ForEach-Object { 'permissions=' + [Uri]::EscapeDataString($_) }) -join '&'
    $response = Invoke-RestMethod -Method Get -Uri "https://storage.googleapis.com/storage/v1/b/$bucketPath/iam/testPermissions?$query" -Headers @{ Authorization = "Bearer $token" } -ErrorAction Stop
    $held = @($response.permissions)
    $missing = @($permissions | Where-Object { $held -notcontains $_ })
    if ($missing.Count -gt 0) { throw "Bucket '$BucketName' is missing required export/verification permissions: $($missing -join ', ')." }
}

function Get-RollbackExportObjectNames {
    param([Parameter(Mandatory = $true)][string]$ExportPrefix)
    $raw = Invoke-RollbackGcloud -Arguments @('storage', 'ls', '--recursive', "$ExportPrefix/**")
    return @($raw | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ -match '^gs://' })
}

function Save-RollbackEvidence {
    param(
        [Parameter(Mandatory = $true)][string]$Directory,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][object]$Value
    )
    New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Directory $Name) -Encoding UTF8
}

function Invoke-FurgokidRollback {
    param(
        [Parameter(Mandatory = $true)][string]$TargetEnvironment,
        [Parameter(Mandatory = $true)][string]$TargetFunction,
        [Parameter(Mandatory = $true)][string]$TargetProjectId
    )

    $validatedProjectId = Assert-FirebaseProjectMatch -Environment $TargetEnvironment -ProjectId $TargetProjectId
    $functions = Get-RollbackFunctionNames -ValidatedProjectId $validatedProjectId
    if ($functions -notcontains $TargetFunction) { throw "Function '$TargetFunction' is not present in project '$validatedProjectId'; refusing to delete." }

    $bucket = Get-FirebaseStorageBucket -ProjectId $validatedProjectId -Environment $TargetEnvironment
    Test-RollbackBucketPermissions -BucketName $bucket.Name

    $timestamp = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
    $exportPrefix = "gs://$($bucket.Name)/furgokid-rollback-exports/$timestamp"
    $evidenceRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Furgokid/rollback-evidence'
    $evidenceDir = Join-Path $evidenceRoot "$TargetEnvironment-$timestamp"

    Write-Host "Target: $TargetFunction`nEnvironment: $TargetEnvironment`nProject: $validatedProjectId`nBucket: $($bucket.Name)`nExport: $exportPrefix" -ForegroundColor Yellow
    Request-DeploymentConfirmation -Prompt 'Type exactly yes to create and verify the Firestore export (no deletion yet).'

    Save-RollbackEvidence -Directory $evidenceDir -Name 'functions-before.json' -Value @($functions)
    $null = Invoke-RollbackFirebase -Arguments @('firestore:export', '--project', $validatedProjectId, $exportPrefix)
    $objectNames = Get-RollbackExportObjectNames -ExportPrefix $exportPrefix
    if (-not (Test-FirestoreExportMetadata -ObjectNames $objectNames -ExportPrefix $exportPrefix)) {
        throw "Firestore export verification failed: overall_export_metadata not found under '$exportPrefix'. Function was not deleted."
    }
    Save-RollbackEvidence -Directory $evidenceDir -Name 'export-objects.json' -Value @($objectNames)

    Request-DeploymentConfirmation -Prompt "Export verified. Type exactly yes to delete only '$TargetFunction' from '$validatedProjectId'."
    $null = Invoke-RollbackFirebase -Arguments @('functions:delete', $TargetFunction, '--project', $validatedProjectId, '--force')

    $remaining = Get-RollbackFunctionNames -ValidatedProjectId $validatedProjectId
    if ($remaining -contains $TargetFunction) { throw "Post-delete verification failed: '$TargetFunction' is still listed." }
    [pscustomobject]@{
        Environment = $TargetEnvironment
        ProjectId = $validatedProjectId
        FunctionName = $TargetFunction
        ExportPrefix = $exportPrefix
        Result = 'VERIFIED_DELETED'
        EvidenceDirectory = $evidenceDir
    }
}

# Dot-sourcing exposes functions for Pester without running any operation.
if ($MyInvocation.InvocationName -ne '.') {
    Invoke-FurgokidRollback -TargetEnvironment $Environment -TargetFunction $FunctionName -TargetProjectId $ProjectId
}

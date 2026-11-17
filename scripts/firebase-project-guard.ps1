# Firebase project guard - fail-closed validation helpers.
#
# Pure functions only: they validate values and throw on any mismatch, but
# never call firebase CLI, never deploy, and never touch network resources.
# Every deploy/rollback script must dot-source this file and pass an explicit
# project id to every firebase call (no aliases, no `firebase use` selection).

$script:FURGOKID_PROJECT_MAP = @{
    staging    = 'furgokid-staging'
    production = 'furgokid'
}

function Get-FirebaseProjectForEnvironment {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('staging', 'production')]
        [string]$Environment
    )
    return $script:FURGOKID_PROJECT_MAP[$Environment]
}

function Resolve-FirebaseProjectId {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('staging', 'production')]
        [string]$Environment,
        [AllowEmptyString()]
        [string]$ProjectId,
        [AllowEmptyString()]
        [string]$EnvironmentVariable = 'FIREBASE_PROJECT_ID'
    )
    $environmentProjectId = [System.Environment]::GetEnvironmentVariable($EnvironmentVariable)
    if (-not [string]::IsNullOrWhiteSpace($ProjectId)) {
        $explicitProjectId = $ProjectId.Trim()
        if (-not [string]::IsNullOrWhiteSpace($environmentProjectId) -and
            $environmentProjectId.Trim() -ne $explicitProjectId) {
            throw "Project id conflict: -ProjectId '$explicitProjectId' contradicts $EnvironmentVariable '$($environmentProjectId.Trim())'. Aborting."
        }
        return $explicitProjectId
    }
    throw "An explicit -ProjectId is required for '$Environment'; environment variables and .firebaserc are never destination defaults."
}

function Assert-FirebaseProjectMatch {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('staging', 'production')]
        [string]$Environment,
        [AllowEmptyString()]
        [string]$ProjectId
    )
    if ([string]::IsNullOrWhiteSpace($ProjectId)) {
        throw "Project id is required for the '$Environment' environment (expected '$($script:FURGOKID_PROJECT_MAP[$Environment])')."
    }
    $expected = $script:FURGOKID_PROJECT_MAP[$Environment]
    if ($ProjectId.Trim() -ne $expected) {
        throw "Environment/project mismatch: '$Environment' requires project '$expected' but got '$($ProjectId.Trim())'. Aborting."
    }
    return $expected
}

function Get-FirebaseStorageBucket {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectId,
        [Parameter(Mandatory = $true)]
        [ValidateSet('staging', 'production')]
        [string]$Environment
    )
    $validatedProjectId = Assert-FirebaseProjectMatch -Environment $Environment -ProjectId $ProjectId
    $token = (& gcloud auth print-access-token 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($token)) {
        throw "Unable to obtain a Google Cloud access token for read-only bucket metadata lookup."
    }

    $headers = @{ Authorization = "Bearer $token" }
    $projectPath = [Uri]::EscapeDataString($validatedProjectId)
    $default = Invoke-RestMethod -Method Get -Uri "https://firebasestorage.googleapis.com/v1alpha/projects/$projectPath/defaultBucket" -Headers $headers -ErrorAction Stop
    $bucketName = [string]$default.bucket.name
    $boundProjectNumber = [string]$default.bucket.projectNumber
    if ([string]::IsNullOrWhiteSpace($bucketName) -or [string]::IsNullOrWhiteSpace($boundProjectNumber)) {
        throw "Firebase default bucket response lacks bucket name or owning project number."
    }

    $bucketPath = [Uri]::EscapeDataString($bucketName)
    $metadata = Invoke-RestMethod -Method Get -Uri "https://storage.googleapis.com/storage/v1/b/$bucketPath?fields=name,projectNumber,location" -Headers $headers -ErrorAction Stop
    $verified = [pscustomobject]@{
        Name = [string]$metadata.name
        ProjectNumber = [string]$metadata.projectNumber
        Location = [string]$metadata.location
        FirebaseProjectId = $validatedProjectId
        FirebaseResourceName = [string]$default.name
    }
    $null = Assert-StorageBucketForProject -ProjectId $validatedProjectId -Environment $Environment -BucketMetadata $verified -ExpectedProjectNumber $boundProjectNumber
    return $verified
}

function Assert-StorageBucketForProject {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectId,
        [Parameter(Mandatory = $true)]
        [ValidateSet('staging', 'production')]
        [string]$Environment,
        [Parameter(Mandatory = $true)]
        [psobject]$BucketMetadata,
        [Parameter(Mandatory = $true)]
        [string]$ExpectedProjectNumber
    )
    $validatedProjectId = Assert-FirebaseProjectMatch -Environment $Environment -ProjectId $ProjectId
    if ($null -eq $BucketMetadata -or
        [string]::IsNullOrWhiteSpace([string]$BucketMetadata.Name) -or
        [string]::IsNullOrWhiteSpace([string]$BucketMetadata.ProjectNumber) -or
        [string]::IsNullOrWhiteSpace([string]$BucketMetadata.Location)) {
        throw "Storage bucket metadata is incomplete; refusing to use an unverified bucket."
    }
    if ($BucketMetadata.FirebaseProjectId -ne $validatedProjectId -or
        [string]$BucketMetadata.ProjectNumber -ne $ExpectedProjectNumber -or
        [string]::IsNullOrWhiteSpace([string]$BucketMetadata.FirebaseResourceName)) {
        throw "Storage bucket metadata does not prove ownership by Firebase project '$validatedProjectId'. Aborting."
    }
    return $BucketMetadata
}

function Test-FirestoreExportMetadata {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$ObjectNames,
        [Parameter(Mandatory = $true)]
        [string]$ExportPrefix
    )
    $prefix = $ExportPrefix.TrimEnd('/') + '/'
    return [bool]($ObjectNames | Where-Object {
        $_.StartsWith($prefix, [System.StringComparison]::Ordinal) -and
        $_.EndsWith('/overall_export_metadata', [System.StringComparison]::Ordinal)
    } | Select-Object -First 1)
}

# Production-grade confirmation: only the exact lowercase token 'yes' counts.
# Anything else ('Yes', 'y', 'YES', 'si', empty) aborts. Pure so tests can
# simulate answers without a console.
function Test-DeploymentConfirmation {
    param(
        [AllowEmptyString()]
        [string]$Response
    )
    return ($Response -ceq 'yes')
}

function Request-DeploymentConfirmation {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Prompt
    )
    $response = Read-Host -Prompt $Prompt
    if (-not (Test-DeploymentConfirmation -Response $response)) {
        throw "Confirmation declined (answer was '$response'). Aborting."
    }
}

function Assert-ProductionTarget {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectId
    )
    $productionProject = $script:FURGOKID_PROJECT_MAP['production']
    return ($ProjectId.Trim() -eq $productionProject)
}

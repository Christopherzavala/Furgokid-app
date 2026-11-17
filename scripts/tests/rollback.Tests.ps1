$guardPath = Join-Path $PSScriptRoot '..\firebase-project-guard.ps1'
$rollbackPath = Join-Path $PSScriptRoot '..\rollback.ps1'
. $guardPath
. $rollbackPath -Environment staging -FunctionName testFunction -ProjectId furgokid-staging

Describe 'Furgokid 10B fail-closed project and bucket guards' {
    It 'maps only the declared environments' {
        (Get-FirebaseProjectForEnvironment -Environment staging) | Should Be 'furgokid-staging'
        (Get-FirebaseProjectForEnvironment -Environment production) | Should Be 'furgokid'
    }

    It 'rejects environment and explicit project mismatches' {
        { Assert-FirebaseProjectMatch -Environment staging -ProjectId furgokid } | Should Throw
    }

    It 'rejects contradictory explicit and environment project values' {
        $prior = [Environment]::GetEnvironmentVariable('FIREBASE_PROJECT_ID', 'Process')
        try {
            [Environment]::SetEnvironmentVariable('FIREBASE_PROJECT_ID', 'furgokid', 'Process')
            { Resolve-FirebaseProjectId -Environment staging -ProjectId furgokid-staging } | Should Throw
        } finally {
            [Environment]::SetEnvironmentVariable('FIREBASE_PROJECT_ID', $prior, 'Process')
        }
    }

    It 'does not use an environment variable as a project default' {
        $prior = [Environment]::GetEnvironmentVariable('FIREBASE_PROJECT_ID', 'Process')
        try {
            [Environment]::SetEnvironmentVariable('FIREBASE_PROJECT_ID', 'furgokid-staging', 'Process')
            { Resolve-FirebaseProjectId -Environment staging } | Should Throw
        } finally {
            [Environment]::SetEnvironmentVariable('FIREBASE_PROJECT_ID', $prior, 'Process')
        }
    }

    It 'accepts actual bucket metadata only when ownership and location are present' {
        $metadata = [pscustomobject]@{ Name = 'furgokid-staging.firebasestorage.app'; ProjectNumber = '123'; Location = 'us-central1'; FirebaseProjectId = 'furgokid-staging'; FirebaseResourceName = 'projects/furgokid-staging/defaultBucket' }
        (Assert-StorageBucketForProject -ProjectId furgokid-staging -Environment staging -BucketMetadata $metadata -ExpectedProjectNumber '123').Name | Should Be $metadata.Name
    }

    It 'rejects bucket metadata for another project or with missing fields' {
        $metadata = [pscustomobject]@{ Name = 'other-bucket'; ProjectNumber = '999'; Location = 'us-central1'; FirebaseProjectId = 'furgokid-staging'; FirebaseResourceName = 'projects/furgokid-staging/defaultBucket' }
        { Assert-StorageBucketForProject -ProjectId furgokid-staging -Environment staging -BucketMetadata $metadata -ExpectedProjectNumber '123' } | Should Throw
        $incomplete = [pscustomobject]@{ Name = 'bucket'; ProjectNumber = '123'; Location = ''; FirebaseProjectId = 'furgokid-staging'; FirebaseResourceName = 'projects/furgokid-staging/defaultBucket' }
        { Assert-StorageBucketForProject -ProjectId furgokid-staging -Environment staging -BucketMetadata $incomplete -ExpectedProjectNumber '123' } | Should Throw
    }

    It 'accepts an export only when its overall metadata marker is under the requested prefix' {
        (Test-FirestoreExportMetadata -ObjectNames @('gs://bucket/path/all_namespaces/kind_kind/2026.export_metadata', 'gs://bucket/path/overall_export_metadata') -ExportPrefix 'gs://bucket/path') | Should Be $true
        (Test-FirestoreExportMetadata -ObjectNames @('gs://bucket/other/overall_export_metadata') -ExportPrefix 'gs://bucket/path') | Should Be $false
    }

    It 'requires the exact lowercase confirmation token' {
        (Test-DeploymentConfirmation -Response 'yes') | Should Be $true
        (Test-DeploymentConfirmation -Response 'YES') | Should Be $false
        (Test-DeploymentConfirmation -Response 'y') | Should Be $false
    }
}

Describe 'Furgokid rollback orchestration' {
    It 'requires verified export and two confirmations before deleting only the selected function' {
        $script:functionListCallCount = 0
        $script:confirmationCount = 0
        Mock Get-RollbackFunctionNames {
            $script:functionListCallCount++
            if ($script:functionListCallCount -eq 1) { return @('sendWelcomeEmail') }
            return @()
        }
        Mock Get-FirebaseStorageBucket { return [pscustomobject]@{ Name = 'furgokid-staging.firebasestorage.app' } }
        Mock Test-RollbackBucketPermissions { }
        Mock Save-RollbackEvidence { }
        Mock Request-DeploymentConfirmation { $script:confirmationCount++ }
        Mock Get-RollbackExportObjectNames { param($ExportPrefix) return @("$ExportPrefix/overall_export_metadata") }
        Mock Invoke-RollbackFirebase { return 'ok' }

        $result = Invoke-FurgokidRollback -TargetEnvironment staging -TargetFunction sendWelcomeEmail -TargetProjectId furgokid-staging
        $result.Result | Should Be 'VERIFIED_DELETED'
        $script:confirmationCount | Should Be 2
        Assert-MockCalled Invoke-RollbackFirebase -Times 1 -ParameterFilter { $Arguments -contains 'functions:delete' }
    }

    It 'does not delete when the final confirmation is declined' {
        $script:confirmationCount = 0
        $script:mutatingFirebaseCallCount = 0
        $script:deleteCallCount = 0
        Mock Get-RollbackFunctionNames { return @('sendWelcomeEmail') }
        Mock Get-FirebaseStorageBucket { return [pscustomobject]@{ Name = 'furgokid-staging.firebasestorage.app' } }
        Mock Test-RollbackBucketPermissions { }
        Mock Save-RollbackEvidence { }
        Mock Get-RollbackExportObjectNames { param($ExportPrefix) return @("$ExportPrefix/overall_export_metadata") }
        Mock Request-DeploymentConfirmation {
            $script:confirmationCount++
            if ($script:confirmationCount -eq 2) { throw 'simulated declined confirmation' }
        }
        Mock Invoke-RollbackFirebase {
            if (($Arguments -contains 'firestore:export') -or ($Arguments -contains 'functions:delete')) { $script:mutatingFirebaseCallCount++ }
            if ($Arguments -contains 'functions:delete') { $script:deleteCallCount++ }
            return 'ok'
        }

        { Invoke-FurgokidRollback -TargetEnvironment staging -TargetFunction sendWelcomeEmail -TargetProjectId furgokid-staging } | Should Throw
        $script:mutatingFirebaseCallCount | Should Be 1
        $script:deleteCallCount | Should Be 0
    }

    It 'does not delete when export verification fails' {
        $script:deleteCallCount = 0
        Mock Get-RollbackFunctionNames { return @('sendWelcomeEmail') }
        Mock Get-FirebaseStorageBucket { return [pscustomobject]@{ Name = 'furgokid-staging.firebasestorage.app' } }
        Mock Test-RollbackBucketPermissions { }
        Mock Save-RollbackEvidence { }
        Mock Request-DeploymentConfirmation { }
        Mock Invoke-RollbackFirebase { if ($Arguments -contains 'functions:delete') { $script:deleteCallCount++ }; if ($Arguments -contains 'functions:list') { return '{"id":"sendWelcomeEmail"}' }; return 'ok' }
        Mock Get-RollbackExportObjectNames { return @() }

        { Invoke-FurgokidRollback -TargetEnvironment staging -TargetFunction sendWelcomeEmail -TargetProjectId furgokid-staging } | Should Throw
        $script:deleteCallCount | Should Be 0
    }

    It 'does not delete when Firebase export command fails' {
        $script:deleteCallCount = 0
        Mock Get-RollbackFunctionNames { return @('sendWelcomeEmail') }
        Mock Get-FirebaseStorageBucket { return [pscustomobject]@{ Name = 'furgokid-staging.firebasestorage.app' } }
        Mock Test-RollbackBucketPermissions { }
        Mock Save-RollbackEvidence { }
        Mock Request-DeploymentConfirmation { }
        Mock Invoke-RollbackFirebase {
            if ($Arguments -contains 'functions:list') { return '{"id":"sendWelcomeEmail"}' }
            if ($Arguments -contains 'firestore:export') { throw 'simulated export failure' }
            if ($Arguments -contains 'functions:delete') { $script:deleteCallCount++ }
            return 'unexpected'
        }

        { Invoke-FurgokidRollback -TargetEnvironment staging -TargetFunction sendWelcomeEmail -TargetProjectId furgokid-staging } | Should Throw
        $script:deleteCallCount | Should Be 0
    }

    It 'does not export or delete when bucket permission preflight fails' {
        $script:mutatingFirebaseCallCount = 0
        Mock Get-RollbackFunctionNames { return @('sendWelcomeEmail') }
        Mock Get-FirebaseStorageBucket { return [pscustomobject]@{ Name = 'furgokid-staging.firebasestorage.app' } }
        Mock Test-RollbackBucketPermissions { throw 'simulated permission failure' }
        Mock Invoke-RollbackFirebase {
            if (($Arguments -contains 'firestore:export') -or ($Arguments -contains 'functions:delete')) { $script:mutatingFirebaseCallCount++ }
            return '{"id":"sendWelcomeEmail"}'
        }

        { Invoke-FurgokidRollback -TargetEnvironment staging -TargetFunction sendWelcomeEmail -TargetProjectId furgokid-staging } | Should Throw
        $script:mutatingFirebaseCallCount | Should Be 0
    }

    It 'rejects mismatched environment before any Firebase command' {
        $script:firebaseCallCount = 0
        Mock Invoke-RollbackFirebase { $script:firebaseCallCount++; return '{"id":"sendWelcomeEmail"}' }
        { Invoke-FurgokidRollback -TargetEnvironment staging -TargetFunction sendWelcomeEmail -TargetProjectId furgokid } | Should Throw
        $script:firebaseCallCount | Should Be 0
    }

    It 'has no all-functions switch or unbounded deletion path' {
        $tokens = $null
        $errors = $null
        $ast = [System.Management.Automation.Language.Parser]::ParseFile($rollbackPath, [ref]$tokens, [ref]$errors)
        $parameters = @($ast.ParamBlock.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath })
        ($parameters -contains 'All') | Should Be $false
        (Get-Content -Raw $rollbackPath) | Should Not Match 'Copy-Item|firebase deploy|functions:delete.*\*'
    }
}

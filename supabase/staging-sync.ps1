[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [string]$ProdDbUrl = $env:SUPABASE_PROD_DB_URL,
    [string]$StagingDbUrl = $env:SUPABASE_STAGING_DB_URL,
    [string[]]$Schemas = @('public'),
    [string]$SeedFile
)

$ErrorActionPreference = 'Stop'

function Get-CommandPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Required command '$Name' was not found in PATH. Install PostgreSQL client tools first."
    }

    return $command.Source
}

function Assert-Value {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value,
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw $Message
    }
}

Assert-Value -Value $ProdDbUrl -Message 'Set SUPABASE_PROD_DB_URL or pass -ProdDbUrl.'
Assert-Value -Value $StagingDbUrl -Message 'Set SUPABASE_STAGING_DB_URL or pass -StagingDbUrl.'

if ($ProdDbUrl -eq $StagingDbUrl) {
    throw 'Prod and staging database URLs must be different.'
}

if ($Schemas.Count -eq 0) {
    throw 'Pass at least one schema name via -Schemas.'
}

if ($SeedFile -and -not (Test-Path -LiteralPath $SeedFile)) {
    throw "Seed file not found: $SeedFile"
}

$pgDump = Get-CommandPath -Name 'pg_dump'
$psql = Get-CommandPath -Name 'psql'

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('minto-food-staging-sync-' + [guid]::NewGuid())
$null = New-Item -ItemType Directory -Path $tempRoot
$dumpFile = Join-Path $tempRoot 'prod-schema.sql'

try {
    $schemaArgs = foreach ($schema in $Schemas) {
        "--schema=$schema"
    }

    $dumpArgs = @(
        '--schema-only',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        '--quote-all-identifiers',
        '--file', $dumpFile
    ) + $schemaArgs + @($ProdDbUrl)

    if ($PSCmdlet.ShouldProcess('staging database', "Replace schema with prod dump from '$($Schemas -join ', ')'.")) {
        & $pgDump @dumpArgs
        if ($LASTEXITCODE -ne 0) {
            throw "pg_dump failed with exit code $LASTEXITCODE."
        }

        & $psql $StagingDbUrl '-v' 'ON_ERROR_STOP=1' '-f' $dumpFile
        if ($LASTEXITCODE -ne 0) {
            throw "psql schema import failed with exit code $LASTEXITCODE."
        }

        if ($SeedFile) {
            & $psql $StagingDbUrl '-v' 'ON_ERROR_STOP=1' '-f' $SeedFile
            if ($LASTEXITCODE -ne 0) {
                throw "psql seed import failed with exit code $LASTEXITCODE."
            }
        }
    }
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}

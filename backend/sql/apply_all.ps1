# Применение схемы Family Budget (Windows / PowerShell)
# Пример:
#   .\sql\apply_all.ps1 -User postgres -Password 1111 -Database budget

param(
  [string]$Host = "localhost",
  [string]$User = "postgres",
  [string]$Password = "",
  [string]$Database = "budget"
)

$env:PGPASSWORD = $Password
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ">> 001_schema.sql"
psql -h $Host -U $User -d $Database -v ON_ERROR_STOP=1 -f (Join-Path $root "001_schema.sql")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ">> 002_legacy_upgrade.sql (идемпотентно)"
psql -h $Host -U $User -d $Database -v ON_ERROR_STOP=1 -f (Join-Path $root "002_legacy_upgrade.sql")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ">> 003_operations_source.sql"
psql -h $Host -U $User -d $Database -v ON_ERROR_STOP=1 -f (Join-Path $root "003_operations_source.sql")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "OK: migrations applied"

param(
  [switch]$SkipCommandDeploy
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$nodePath = 'C:\Program Files\nodejs'
$dockerPath = 'C:\Program Files\Docker\Docker\resources\bin'
$env:PATH = "$nodePath;$dockerPath;$env:PATH"

Set-Location $repo

if (-not (Test-Path -LiteralPath '.env')) {
  throw 'Missing .env. Copy .env.example to .env and fill in the Discord test credentials first.'
}

Write-Host 'Checking Docker daemon...'
docker info *> $null

Write-Host 'Starting Postgres...'
docker compose up -d

Write-Host 'Generating Prisma Client...'
npm run db:generate

Write-Host 'Applying Prisma migrations...'
npm run db:migrate

if (-not $SkipCommandDeploy) {
  Write-Host 'Deploying Discord commands...'
  npm run deploy:commands
}

Write-Host 'Starting bot. Leave this terminal open while testing Discord.'
npm run start

$ErrorActionPreference = "Stop"

$ApiBase = "https://api.dataforseo.com/v3"
$OutputDir = Join-Path $PSScriptRoot ""
$Category = "demolition_contractor"
$PageLimit = 2

$envRows = Get-Content -LiteralPath (Join-Path (Get-Location) ".env.local")
foreach ($line in $envRows) {
  if ($line -match "^DATAFORSEO_LOGIN=(.*)$") {
    $DfsLogin = $Matches[1].Trim('"', "'")
  }
  if ($line -match "^DATAFORSEO_PASSWORD=(.*)$") {
    $DfsPassword = $Matches[1].Trim('"', "'")
  }
}
if (-not $DfsLogin -or -not $DfsPassword) {
  throw "DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD não configurados."
}

$authBytes = [Text.Encoding]::UTF8.GetBytes("${DfsLogin}:${DfsPassword}")
$Headers = @{
  Authorization = "Basic $([Convert]::ToBase64String($authBytes))"
  "Content-Type" = "application/json; charset=utf-8"
}

function Invoke-DfsGet([string]$Path) {
  Invoke-RestMethod -Uri "$ApiBase$Path" -Headers $Headers -Method Get -TimeoutSec 30
}

function Invoke-DfsPost([string]$Path, [hashtable]$Task) {
  $body = ConvertTo-Json -InputObject @($Task) -Depth 20 -Compress
  Invoke-RestMethod -Uri "$ApiBase$Path" -Headers $Headers -Method Post -Body $body -TimeoutSec 30
}

function Read-Task($Body) {
  @($Body.tasks)[0]
}

function Read-Result($Body) {
  $task = Read-Task $Body
  @($task.result)[0]
}

function Read-Item($Item) {
  [ordered]@{
    type = $Item.type
    place_id = $Item.place_id
    cid = $Item.cid
    feature_id = $Item.feature_id
    title = $Item.title
    category = $Item.category
    category_ids = @($Item.category_ids)
    additional_categories = @($Item.additional_categories)
    address = $Item.address
    address_info = $Item.address_info
    phone = $Item.phone
    url = $Item.url
    latitude = $Item.latitude
    longitude = $Item.longitude
    rating = if ($null -eq $Item.rating) { $null } else { [ordered]@{ value = $Item.rating.value; votes_count = $Item.rating.votes_count } }
    current_status = $Item.work_time.current_status
    check_url = $Item.check_url
    last_updated_time = $Item.last_updated_time
  }
}

function Read-Envelope($Body) {
  $task = Read-Task $Body
  $page = Read-Result $Body
  $items = @($page.items | ForEach-Object { Read-Item $_ })
  [ordered]@{
    captured_at = [DateTimeOffset]::UtcNow.ToString("o")
    envelope = [ordered]@{
      version = $Body.version
      status_code = $Body.status_code
      status_message = $Body.status_message
      cost = $Body.cost
      tasks_count = $Body.tasks_count
      tasks_error = $Body.tasks_error
    }
    task = [ordered]@{
      id = $task.id
      status_code = $task.status_code
      status_message = $task.status_message
      cost = $task.cost
      path = @($task.path)
    }
    page = [ordered]@{
      total_count = $page.total_count
      count = $page.count
      items_count = $page.items_count
      offset = $page.offset
      offset_token = $page.offset_token
      items = $items
    }
  }
}

function Write-Evidence([string]$Name, $Value) {
  $json = ConvertTo-Json -InputObject $Value -Depth 30
  [IO.File]::WriteAllText((Join-Path $OutputDir $Name), "$json`n", [Text.UTF8Encoding]::new($false))
}

$categories = Invoke-DfsGet "/business_data/business_listings/categories"
$categoryTask = Read-Task $categories
$categoryMatches = @($categoryTask.result | Where-Object { $_.category_name -eq $Category })
$categoryEvidence = [ordered]@{
  captured_at = [DateTimeOffset]::UtcNow.ToString("o")
  envelope = [ordered]@{
    version = $categories.version
    status_code = $categories.status_code
    status_message = $categories.status_message
    cost = $categories.cost
    tasks_count = $categories.tasks_count
    tasks_error = $categories.tasks_error
  }
  task = [ordered]@{
    status_code = $categoryTask.status_code
    status_message = $categoryTask.status_message
    cost = $categoryTask.cost
  }
  matches = @($categoryMatches | ForEach-Object { [ordered]@{ category_name = $_.category_name; business_count = $_.business_count } })
}
Write-Evidence "01-categories.redacted.json" $categoryEvidence

$baseTask = [ordered]@{
  categories = @($Category)
  language_code = "pt"
  location_coordinate = "-23.55052,-46.633308,45"
  limit = $PageLimit
}
$firstBody = Invoke-DfsPost "/business_data/business_listings/search/live" $baseTask
$first = Read-Envelope $firstBody
Write-Evidence "02-demolition-sp-first-page.redacted.json" $first

$firstCount = if ($null -ne $first.page.count) { [int]$first.page.count } elseif ($null -ne $first.page.items_count) { [int]$first.page.items_count } else { @($first.page.items).Count }
$secondTask = [ordered]@{}
foreach ($entry in $baseTask.GetEnumerator()) { $secondTask[$entry.Key] = $entry.Value }
if (-not [string]::IsNullOrWhiteSpace([string]$first.page.offset_token)) {
  $secondTask["offset_token"] = $first.page.offset_token
} else {
  $firstOffset = if ($null -eq $first.page.offset) { 0 } else { [int]$first.page.offset }
  $secondTask["offset"] = $firstOffset + $firstCount
}
$secondBody = Invoke-DfsPost "/business_data/business_listings/search/live" $secondTask
$second = Read-Envelope $secondBody
Write-Evidence "03-demolition-sp-next-page.redacted.json" $second

$firstIds = @{}
foreach ($item in @($first.page.items)) {
  if (-not [string]::IsNullOrWhiteSpace([string]$item.place_id)) { $firstIds[[string]$item.place_id] = $true }
}
$repeated = @($second.page.items | Where-Object { $_.place_id -and $firstIds.ContainsKey([string]$_.place_id) } | ForEach-Object { $_.place_id })
if ($repeated.Count -gt 0) {
  throw "A segunda página repetiu place_id: $($repeated -join ', ')"
}
$missingIdentity = @($first.page.items | Where-Object { [string]::IsNullOrWhiteSpace([string]$_.place_id) }).Count
if ($missingIdentity -gt 0) {
  throw "A primeira amostra contém item sem place_id."
}

[ordered]@{
  categoriesMatched = $categoryMatches.Count
  firstPage = [ordered]@{
    totalCount = $first.page.total_count
    count = $firstCount
    offset = $first.page.offset
    hasOffsetToken = -not [string]::IsNullOrWhiteSpace([string]$first.page.offset_token)
    cost = $first.task.cost
  }
  secondPage = [ordered]@{
    count = if ($null -ne $second.page.count) { $second.page.count } elseif ($null -ne $second.page.items_count) { $second.page.items_count } else { @($second.page.items).Count }
    offset = $second.page.offset
    hasOffsetToken = -not [string]::IsNullOrWhiteSpace([string]$second.page.offset_token)
    cost = $second.task.cost
  }
} | ConvertTo-Json -Depth 5 -Compress

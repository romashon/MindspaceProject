param(
    [Parameter(Mandatory = $true)]
    [string]$MyDomainUrl,
    [ValidatePattern('^\d{2,3}\.0$')]
    [string]$ApiVersion = '65.0',
    [switch]$CopyAccessToken
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$domain = $null

if (-not [Uri]::TryCreate($MyDomainUrl, [UriKind]::Absolute, [ref]$domain)) {
    throw 'MyDomainUrl must be an HTTPS origin.'
}

if ($domain.Scheme -ne 'https' -or $domain.UserInfo -or $domain.AbsolutePath -ne '/' -or $domain.Query -or $domain.Fragment) {
    throw 'MyDomainUrl must be an HTTPS origin without credentials or parameters.'
}

$origin = $domain.GetLeftPart([UriPartial]::Authority)
$clientId = Read-Host 'Salesforce Consumer Key'
$secureSecret = Read-Host 'Salesforce Consumer Secret' -AsSecureString
$secretPointer = [IntPtr]::Zero
$clientSecret = $null
$tokenResponse = $null
$accessToken = $null
$headers = $null
$body = $null

try {
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
    $clientSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    $body = @{ grant_type = 'client_credentials'; client_id = $clientId; client_secret = $clientSecret }

    try {
        $tokenResponse = Invoke-RestMethod -Method Post -Uri "$origin/services/oauth2/token" -ContentType 'application/x-www-form-urlencoded' -Body $body -TimeoutSec 30 -MaximumRedirection 0
    } catch {
        throw 'OAuth request failed. Check My Domain, Consumer Key/Secret, client credentials flow, Run As, and network policy. Do not share raw error responses.'
    }

    $instance = $null
    if (-not $tokenResponse.access_token -or -not [Uri]::TryCreate($tokenResponse.instance_url, [UriKind]::Absolute, [ref]$instance)) {
        throw 'OAuth response did not contain an access token and a valid instance URL.'
    }

    if ($instance.Scheme -ne 'https' -or $instance.UserInfo -or $instance.AbsolutePath -ne '/' -or $instance.Query -or $instance.Fragment) {
        throw 'OAuth response contained an unsafe instance URL.'
    }

    $instanceOrigin = $instance.GetLeftPart([UriPartial]::Authority)
    $accessToken = [string]$tokenResponse.access_token
    $headers = @{ Authorization = "Bearer $accessToken"; Accept = 'application/json' }
    $query = [Uri]::EscapeDataString('SELECT Id, Name, BillingCity, BillingCountry FROM Account ORDER BY Name, Id')

    try {
        $result = Invoke-RestMethod -Method Get -Uri "$instanceOrigin/services/data/v$ApiVersion/query?q=$query" -Headers $headers -TimeoutSec 30 -MaximumRedirection 0
    } catch {
        throw 'Account query failed. Check API version, API Enabled, Account read permission, field access, and IP policy. Do not share raw error responses.'
    }

    Write-Host "OAuth and Account REST query succeeded. Instance URL: $instanceOrigin"
    Write-Host "Accounts visible: $($result.totalSize). Records in first page: $(@($result.records).Count). Query complete: $($result.done)."

    if ($CopyAccessToken) {
        Set-Clipboard -Value $accessToken
        Write-Host 'Access token copied to clipboard. Paste only into private server configuration; clear clipboard and history afterward.'
    }
} finally {
    if ($secretPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    }
    $clientSecret = $null
    $accessToken = $null
    $headers = $null
    $body = $null
    $tokenResponse = $null
    $secureSecret.Dispose()
}
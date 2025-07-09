# In-Out Games Integration Test Suite
# This script tests all aspects of the In-Out Games integration

param(
    [string]$BaseUrl = "http://localhost:8001",
    [string]$SecretKey = "test_secret_key_123",
    [string]$OperatorId = "test_operator_123"
)

# Test configuration
$TestConfig = @{
    BaseUrl      = $BaseUrl
    SecretKey    = $SecretKey
    OperatorId   = $OperatorId
    TestUserId   = "test_user_123"
    TestGameId   = "test_game_456"
    TestCurrency = "USD"
}

# Initialize test results
$TestResults = @{
    TotalTests  = 0
    PassedTests = 0
    FailedTests = 0
    Errors      = @()
    Details     = @()
}

# Helper function to calculate HMAC signature
function Get-HmacSignature {
    param(
        [string]$Data,
        [string]$SecretKey
    )
    
    try {
        $hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($SecretKey))
        $hash = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Data))
        return [System.Convert]::ToBase64String($hash)
    }
    catch {
        Write-Error "Error calculating HMAC signature: $_"
        return $null
    }
}

# Helper function to make HTTP requests
function Invoke-TestRequest {
    param(
        [string]$Url,
        [hashtable]$Headers = @{},
        [hashtable]$Body = @{},
        [string]$Method = "POST"
    )
    
    try {
        $jsonBody = $Body | ConvertTo-Json -Depth 10
        $response = Invoke-RestMethod -Uri $Url -Method $Method -Headers $Headers -Body $jsonBody -ContentType "application/json" -TimeoutSec 30
        return @{
            Success    = $true
            Data       = $response
            StatusCode = 200
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = $_.Exception.Message
        return @{
            Success    = $false
            Error      = $errorMessage
            StatusCode = $statusCode
        }
    }
}

# Test function
function Test-InoutEndpoint {
    param(
        [string]$TestName,
        [string]$Endpoint,
        [hashtable]$RequestData,
        [scriptblock]$ValidationScript,
        [string]$Method = "POST"
    )
    
    $TestResults.TotalTests++
    Write-Host "`n🧪 Running Test: $TestName" -ForegroundColor Cyan
    
    try {
        # Prepare request data
        $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        $requestDataWithTimestamp = $RequestData.Clone()
        $requestDataWithTimestamp.timestamp = $timestamp
        
        # Calculate signature
        $signatureData = $requestDataWithTimestamp | ConvertTo-Json -Compress
        $signature = Get-HmacSignature -Data $signatureData -SecretKey $TestConfig.SecretKey
        
        # Prepare headers
        $headers = @{
            "Content-Type"   = "application/json"
            "x-request-sign" = $signature
        }
        
        # Make request
        $url = "$($TestConfig.BaseUrl)$Endpoint"
        $result = Invoke-TestRequest -Url $url -Headers $headers -Body $requestDataWithTimestamp -Method $Method
        
        # Validate response
        if ($result.Success) {
            $validationResult = & $ValidationScript -Response $result.Data -StatusCode $result.StatusCode
            if ($validationResult) {
                $TestResults.PassedTests++
                Write-Host "✅ PASS: $TestName" -ForegroundColor Green
                $TestResults.Details += @{
                    Test     = $TestName
                    Status   = "PASS"
                    Response = $result.Data
                }
                return $true
            }
            else {
                $TestResults.FailedTests++
                Write-Host "❌ FAIL: $TestName - Validation failed" -ForegroundColor Red
                $TestResults.Details += @{
                    Test     = $TestName
                    Status   = "FAIL"
                    Error    = "Validation failed"
                    Response = $result.Data
                }
                return $false
            }
        }
        else {
            $TestResults.FailedTests++
            Write-Host "❌ FAIL: $TestName - HTTP Error: $($result.StatusCode) - $($result.Error)" -ForegroundColor Red
            $TestResults.Details += @{
                Test   = $TestName
                Status = "FAIL"
                Error  = "HTTP $($result.StatusCode): $($result.Error)"
            }
            return $false
        }
    }
    catch {
        $TestResults.FailedTests++
        $TestResults.Errors += "Test '$TestName' failed with exception: $_"
        Write-Host "❌ FAIL: $TestName - Exception: $_" -ForegroundColor Red
        return $false
    }
}

# Test scenarios
Write-Host "🚀 Starting In-Out Games Integration Test Suite" -ForegroundColor Yellow
Write-Host "Base URL: $($TestConfig.BaseUrl)" -ForegroundColor Yellow
Write-Host "Secret Key: $($TestConfig.SecretKey)" -ForegroundColor Yellow
Write-Host "Operator ID: $($TestConfig.OperatorId)" -ForegroundColor Yellow

# Test 1: Session Initialization
Test-InoutEndpoint -TestName "Session Initialization" -Endpoint "/api/callback/inout" -RequestData @{
    action    = "init"
    user_id   = $TestConfig.TestUserId
    currency  = $TestConfig.TestCurrency
    timestamp = 0  # Will be overridden
} -ValidationScript {
    param($Response, $StatusCode)
    return $Response.code -eq "OK" -and $Response.balance -ne $null
}

# Test 2: Bet Action
Test-InoutEndpoint -TestName "Bet Action" -Endpoint "/api/callback/inout" -RequestData @{
    action         = "bet"
    user_id        = $TestConfig.TestUserId
    amount         = "10.00"
    transaction_id = "test_bet_$(Get-Random)"
    game_id        = $TestConfig.TestGameId
    currency       = $TestConfig.TestCurrency
    timestamp      = 0  # Will be overridden
} -ValidationScript {
    param($Response, $StatusCode)
    return $Response.code -eq "OK" -and $Response.balance -ne $null
}

# Test 3: Credit Action
Test-InoutEndpoint -TestName "Credit Action" -Endpoint "/api/callback/inout" -RequestData @{
    action         = "credit"
    user_id        = $TestConfig.TestUserId
    amount         = "5.00"
    transaction_id = "test_credit_$(Get-Random)"
    game_id        = $TestConfig.TestGameId
    currency       = $TestConfig.TestCurrency
    timestamp      = 0  # Will be overridden
} -ValidationScript {
    param($Response, $StatusCode)
    return $Response.code -eq "OK" -and $Response.balance -ne $null
}

# Test 4: Withdraw Action
Test-InoutEndpoint -TestName "Withdraw Action" -Endpoint "/api/callback/inout" -RequestData @{
    action         = "withdraw"
    user_id        = $TestConfig.TestUserId
    amount         = "3.00"
    transaction_id = "test_withdraw_$(Get-Random)"
    game_id        = $TestConfig.TestGameId
    currency       = $TestConfig.TestCurrency
    timestamp      = 0  # Will be overridden
} -ValidationScript {
    param($Response, $StatusCode)
    return $Response.code -eq "OK" -and $Response.balance -ne $null
}

# Test 5: Rollback Action
Test-InoutEndpoint -TestName "Rollback Action" -Endpoint "/api/callback/inout" -RequestData @{
    action         = "rollback"
    user_id        = $TestConfig.TestUserId
    transaction_id = "test_rollback_$(Get-Random)"
    game_id        = $TestConfig.TestGameId
    currency       = $TestConfig.TestCurrency
    timestamp      = 0  # Will be overridden
} -ValidationScript {
    param($Response, $StatusCode)
    return $Response.code -eq "OK" -and $Response.balance -ne $null
}

# Test 6: Idempotency Test (Same transaction ID)
$sameTransactionId = "idempotency_test_$(Get-Random)"
Test-InoutEndpoint -TestName "Idempotency Test 1" -Endpoint "/api/callback/inout" -RequestData @{
    action         = "bet"
    user_id        = $TestConfig.TestUserId
    amount         = "1.00"
    transaction_id = $sameTransactionId
    game_id        = $TestConfig.TestGameId
    currency       = $TestConfig.TestCurrency
    timestamp      = 0  # Will be overridden
} -ValidationScript {
    param($Response, $StatusCode)
    return $Response.code -eq "OK"
}

Test-InoutEndpoint -TestName "Idempotency Test 2" -Endpoint "/api/callback/inout" -RequestData @{
    action         = "bet"
    user_id        = $TestConfig.TestUserId
    amount         = "1.00"
    transaction_id = $sameTransactionId
    game_id        = $TestConfig.TestGameId
    currency       = $TestConfig.TestCurrency
    timestamp      = 0  # Will be overridden
} -ValidationScript {
    param($Response, $StatusCode)
    return $Response.code -eq "OK"
}

# Test 7: Invalid Signature Test
Test-InoutEndpoint -TestName "Invalid Signature Test" -Endpoint "/api/callback/inout" -RequestData @{
    action    = "init"
    user_id   = $TestConfig.TestUserId
    currency  = $TestConfig.TestCurrency
    timestamp = 0  # Will be overridden
} -ValidationScript {
    param($Response, $StatusCode)
    # Should fail due to invalid signature
    return $StatusCode -eq 401 -or $StatusCode -eq 403
} -Headers @{
    "Content-Type"   = "application/json"
    "x-request-sign" = "invalid_signature"
}

# Test 8: Missing Signature Test
Test-InoutEndpoint -TestName "Missing Signature Test" -Endpoint "/api/callback/inout" -RequestData @{
    action    = "init"
    user_id   = $TestConfig.TestUserId
    currency  = $TestConfig.TestCurrency
    timestamp = 0  # Will be overridden
} -ValidationScript {
    param($Response, $StatusCode)
    # Should fail due to missing signature
    return $StatusCode -eq 401 -or $StatusCode -eq 403
} -Headers @{
    "Content-Type" = "application/json"
}

# Test 9: Invalid Action Test
Test-InoutEndpoint -TestName "Invalid Action Test" -Endpoint "/api/callback/inout" -RequestData @{
    action    = "invalid_action"
    user_id   = $TestConfig.TestUserId
    currency  = $TestConfig.TestCurrency
    timestamp = 0  # Will be overridden
} -ValidationScript {
    param($Response, $StatusCode)
    # Should fail due to invalid action
    return $StatusCode -eq 400 -or $Response.code -eq "ERROR"
}

# Test 10: Launch URL Generation
Test-InoutEndpoint -TestName "Launch URL Generation" -Endpoint "/inout/launch" -RequestData @{
    user_id  = $TestConfig.TestUserId
    currency = $TestConfig.TestCurrency
} -Method "GET" -ValidationScript {
    param($Response, $StatusCode)
    return $Response.launch_url -ne $null -and $Response.launch_url -like "*http*"
}

# Generate test report
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$reportFile = "inout_test_report_$timestamp.txt"

$report = @"
In-Out Games Integration Test Report
Generated: $(Get-Date)
Base URL: $($TestConfig.BaseUrl)
Secret Key: $($TestConfig.SecretKey)
Operator ID: $($TestConfig.OperatorId)

Test Summary:
- Total Tests: $($TestResults.TotalTests)
- Passed: $($TestResults.PassedTests)
- Failed: $($TestResults.FailedTests)
- Success Rate: $([math]::Round(($TestResults.PassedTests / $TestResults.TotalTests) * 100, 2))%

Detailed Results:
"@

foreach ($detail in $TestResults.Details) {
    $report += "`n`nTest: $($detail.Test)"
    $report += "`nStatus: $($detail.Status)"
    if ($detail.Error) {
        $report += "`nError: $($detail.Error)"
    }
    if ($detail.Response) {
        $report += "`nResponse: $($detail.Response | ConvertTo-Json -Depth 3)"
    }
}

if ($TestResults.Errors.Count -gt 0) {
    $report += "`n`nErrors:`n"
    foreach ($errorItem in $TestResults.Errors) {
        $report += "- $errorItem`n"
    }
}

$report | Out-File -FilePath $reportFile -Encoding UTF8

# Display summary
Write-Host "`n" + "="*60 -ForegroundColor Yellow
Write-Host "TEST SUMMARY" -ForegroundColor Yellow
Write-Host "="*60 -ForegroundColor Yellow
Write-Host "Total Tests: $($TestResults.TotalTests)" -ForegroundColor White
Write-Host "Passed: $($TestResults.PassedTests)" -ForegroundColor Green
Write-Host "Failed: $($TestResults.FailedTests)" -ForegroundColor Red
Write-Host "Success Rate: $([math]::Round(($TestResults.PassedTests / $TestResults.TotalTests) * 100, 2))%" -ForegroundColor Cyan
Write-Host "Report saved to: $reportFile" -ForegroundColor Cyan
Write-Host "="*60 -ForegroundColor Yellow

if ($TestResults.FailedTests -eq 0) {
    Write-Host "🎉 All tests passed! Integration is working correctly." -ForegroundColor Green
}
else {
    Write-Host "⚠️  Some tests failed. Please check the detailed report." -ForegroundColor Yellow
} 
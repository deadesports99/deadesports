$path = "android/app-admin/src/main/java/com/tourney/admin/AdminSettingsScreen.kt"
$utf8 = [System.Text.Encoding]::UTF8
$lines = [System.IO.File]::ReadAllLines($path, $utf8)

# Find lines containing AuthMethodRow
$newLines = [System.Collections.Generic.List[string]]::new()
$inBlock = $false
$replaced = $false

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line.Contains("AuthMethodRow(") -and !$replaced) {
        # Skip until after the 3rd AuthMethodRow closing parenthesis
        $replaced = $true
        # Add new AuthMethodRows
        $newLines.Add('                        AuthMethodRow(')
        $newLines.Add('                            icon = "📩",')
        $newLines.Add('                            title = "Phone Auth (Firebase SMS OTP)",')
        $newLines.Add('                            subtitle = "Player verifies their phone number with a 6-digit SMS verification code.",')
        $newLines.Add('                            checked = allowPhoneAuth,')
        $newLines.Add('                            onCheckedChange = { checked ->')
        $newLines.Add('                                if (!checked && !allowEmailAuth && !allowGoogleAuth) return@AuthMethodRow')
        $newLines.Add('                                allowPhoneAuth = checked')
        $newLines.Add('                            }')
        $newLines.Add('                        )')
        $newLines.Add('')
        $newLines.Add('                        Spacer(Modifier.height(12.dp))')
        $newLines.Add('')
        $newLines.Add('                        AuthMethodRow(')
        $newLines.Add('                            icon = "✉️",')
        $newLines.Add('                            title = "Email + Password + OTP",')
        $newLines.Add('                            subtitle = "Player registers/logs in with Email and Password, verified via 6-digit Email OTP.",')
        $newLines.Add('                            checked = allowEmailAuth,')
        $newLines.Add('                            onCheckedChange = { checked ->')
        $newLines.Add('                                if (!checked && !allowPhoneAuth && !allowGoogleAuth) return@AuthMethodRow')
        $newLines.Add('                                allowEmailAuth = checked')
        $newLines.Add('                            }')
        $newLines.Add('                        )')
        $newLines.Add('')
        $newLines.Add('                        Spacer(Modifier.height(12.dp))')
        $newLines.Add('')
        $newLines.Add('                        AuthMethodRow(')
        $newLines.Add('                            icon = "🚀",')
        $newLines.Add('                            title = "1-Tap Google Sign-In",')
        $newLines.Add('                            subtitle = "Player logs in with their Google Account in one tap.",')
        $newLines.Add('                            checked = allowGoogleAuth,')
        $newLines.Add('                            onCheckedChange = { checked ->')
        $newLines.Add('                                if (!checked && !allowPhoneAuth && !allowEmailAuth) return@AuthMethodRow')
        $newLines.Add('                                allowGoogleAuth = checked')
        $newLines.Add('                            }')
        $newLines.Add('                        )')
        # Fast forward $i past line 248 (past the 3 AuthMethodRow blocks)
        # Advance till after line with allowGoogleAuth = checked } )
        while ($i -lt $lines.Length -and !$lines[$i].Contains("allowGoogleAuth = checked")) {
            $i++
        }
        # Skip the closing } and )
        while ($i -lt $lines.Length -and ($lines[$i].Trim() -eq '}' -or $lines[$i].Trim() -eq ')')) {
            $i++
        }
        $i-- # adjust loop step
    } else {
        $newLines.Add($line)
    }
}

[System.IO.File]::WriteAllLines($path, $newLines, $utf8)
Write-Output "DONE_REPLACED"

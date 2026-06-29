# ============================================================
# auto_push.ps1 - Watcher de auto-push para o GitHub
# Monitora mudancas na pasta do projeto e faz git push
# ============================================================

$repoPath    = "C:\Users\jones\avida-nao-colabora-blog"
$watchFolder = "$repoPath\kind-lucid-clarke\mnt\outputs\avida-nao-colabora-blog\src"
$logFile     = "$repoPath\auto_push.log"

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts  $msg" | Out-File -Append -FilePath $logFile -Encoding utf8
}

Write-Log "=== auto_push iniciado. Monitorando: $watchFolder"

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path   = $watchFolder
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName

# Debounce: aguarda 5s de inatividade antes de fazer push
$debounceTimer = $null
$pendingPush   = $false

$action = {
    $script:pendingPush = $true
}

Register-ObjectEvent $watcher "Changed" -Action $action | Out-Null
Register-ObjectEvent $watcher "Created" -Action $action | Out-Null
Register-ObjectEvent $watcher "Deleted" -Action $action | Out-Null

$watcher.EnableRaisingEvents = $true

Write-Log "Watcher ativo. Aguardando mudancas..."

while ($true) {
    Start-Sleep -Seconds 5

    if ($pendingPush) {
        $pendingPush = $false
        Start-Sleep -Seconds 3  # debounce extra

        Write-Log "Mudancas detectadas. Executando git push..."

        $result = & git -C $repoPath add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/" 2>&1
        $status = & git -C $repoPath diff --cached --quiet 2>&1

        if ($LASTEXITCODE -ne 0) {
            # Ha mudancas staged
            $commitMsg = "chore: atualizacao automatica $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
            & git -C $repoPath commit -m $commitMsg 2>&1 | Out-Null
            Write-Log "Commit: $commitMsg"
        }

        $pushResult = & git -C $repoPath push 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Push concluido com sucesso."
        } else {
            Write-Log "Push falhou: $pushResult"
        }
    }
}

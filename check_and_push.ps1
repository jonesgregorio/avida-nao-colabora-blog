# check_and_push.ps1
# Verifica se ha commits nao enviados e faz push automaticamente
# Rodado pelo Agendador de Tarefas a cada 2 minutos

$repoPath = "C:\Users\jones\avida-nao-colabora-blog"
$logFile  = "$repoPath\auto_push.log"

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts  $msg" | Out-File -Append -FilePath $logFile -Encoding utf8
}

# Verificar se ha commits locais nao enviados
$unpushed = & git -C $repoPath log --branches --not --remotes --oneline 2>&1

if ($unpushed -and $unpushed.Trim() -ne "") {
    Write-Log "Commits pendentes encontrados. Fazendo push..."
    $result = & git -C $repoPath push 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Push OK: $($unpushed -join ', ')"
    } else {
        Write-Log "Push falhou: $result"
    }
}

from pathlib import Path

ROOT = Path('kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog')


def replace(rel: str, old: str, new: str) -> None:
    path = ROOT / rel
    text = path.read_text(encoding='utf-8')
    if new in text:
        print(f'already applied: {rel}')
        return
    if old not in text:
        print(f'warning: expected block not found in {rel}; leaving file unchanged')
        return
    path.write_text(text.replace(old, new), encoding='utf-8')
    print(f'updated: {rel}')


# Essencial: corrigir a sugestão incorreta de relatório mensal para leitura semanal.
replace(
    'src/lib/personalizationTasks.ts',
    """    key: 'report_suggestion',
    title: 'Sugestão de relatório mensal',
    description: 'Sugestão de relatório para o usuário gerar no mês.',
    contentType: 'report_suggestion',
    targetArea: 'reports',
    notificationTitle: 'Hora de gerar seu relatório',
    notificationBody: 'Este é um bom momento para gerar seu relatório mensal.',
    frequency: 'monthly',
    minPlan: 'essential',
    priority: 'medium',
    dueType: 'day_of_month',
    dueParam: 5,
    dueNextMonth: true,
    expiresAfterDueDays: null,
""",
    """    key: 'weekly_report_suggestion',
    title: 'Destaques da sua semana',
    description: 'Lembrete para o usuário Essencial ou Plus consultar a leitura semanal automática, sem confundir com relatório mensal.',
    contentType: 'weekly_report_suggestion',
    targetArea: 'reports',
    notificationTitle: 'Sua leitura semanal está disponível',
    notificationBody: 'Este é um bom momento para ver os destaques da sua semana.',
    frequency: 'weekly',
    minPlan: 'essential',
    priority: 'medium',
    dueType: 'start_of_next_week',
    expiresAfterDueDays: 5,
""",
)
replace('src/lib/personalizationTasks.ts', "meditations: 'Meditações'", "meditations: 'Pausas emocionais'")
replace('src/lib/personalizationTasks.ts', "monthly_summary: 'Resumo mensal'", "monthly_summary: 'Resumo mensal simples'")
replace('src/lib/personalizationTasks.ts', "report_suggestion: 'Sugestão de relatório'", "weekly_report_suggestion: 'Destaques da semana'")

# Mapa emocional: seletor de mês também no Resumo e Conexões do mês coerentes com o período selecionado.
replace(
    'src/components/MyEvolutionPage.tsx',
    """  const current = monthKey()
  const { stats, loading } = useDiaryStats(user?.id, current)
  const isPlus = hasPlan(plan, 'plus')
  // Só busca entries pra Conexões do mês quando o plano realmente usa o card
  // (Plus renderiza completo; useMonthAnalysis já tem seu próprio loading interno).
  const { entries: connectionEntries } = useMonthAnalysis(isPlus ? user?.id : undefined, current)
""",
    """  const [selectedMonth, setSelectedMonth] = useState(monthKey())
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return monthKey(d) })
  const { stats, loading } = useDiaryStats(user?.id, selectedMonth)
  const isPlus = hasPlan(plan, 'plus')
  // Só busca entries pra Conexões do mês quando o plano realmente usa o card
  // (Plus renderiza completo; useMonthAnalysis já tem seu próprio loading interno).
  const { entries: connectionEntries } = useMonthAnalysis(isPlus ? user?.id : undefined, selectedMonth)
""",
)
replace(
    'src/components/MyEvolutionPage.tsx',
    """    <div className=\"space-y-5\">\n      {/* Visão geral: anel + gráfico */}\n""",
    """    <div className=\"space-y-5\">\n      <div className=\"flex items-center gap-3\">\n        <label className=\"text-sm text-ink-soft\">Mês do resumo:</label>\n        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className=\"border border-line rounded-lg px-3 py-1.5 text-sm bg-paper-soft focus:outline-none\">\n          {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}\n        </select>\n      </div>\n      {/* Visão geral: anel + gráfico */}\n""",
)
replace('src/components/MyEvolutionPage.tsx', 'Como você se sentiu em {monthLabel(current)}.', 'Como você se sentiu em {monthLabel(selectedMonth)}.')
replace(
    'src/components/MyEvolutionPage.tsx',
    "`Você fez ${stats.totalEntries} ${stats.totalEntries === 1 ? 'registro' : 'registros'} em ${monthLabel(current)}. Olhar para o que sente, um dia de cada vez, já é uma forma de cuidado. Continue assim.`",
    "`Você fez ${stats.totalEntries} ${stats.totalEntries === 1 ? 'registro' : 'registros'} em ${monthLabel(selectedMonth)}. Olhar para o que sente, um dia de cada vez, já é uma forma de cuidado. Continue assim.`",
)
replace(
    'src/components/MyEvolutionPage.tsx',
    "'Ainda não há registros neste mês. Um pequeno registro por dia já ajuda a entender seus padrões. Comece quando quiser.'",
    "`Ainda não há registros em ${monthLabel(selectedMonth)}. Um pequeno registro por dia já ajuda a entender seus padrões. Comece quando quiser.`",
)

# Limpeza visual/editorial dos termos legados, preservando valores técnicos no banco.
changes = {
    'src/App.tsx': [('Práticas/meditações/desafios/trilhas', 'Práticas/pausas emocionais/desafios/trilhas')],
    'src/lib/officialPlans.ts': [('avaliações semanais, meditações/relatórios/suporte', 'avaliações semanais, pausas emocionais/relatórios/suporte')],
    'src/lib/permissions.ts': [('Nada de meditações/pdf/suporte isolados', 'Nada de pausas emocionais/pdf/suporte isolados')],
    'src/components/DiaryCard.tsx': [('acesse meditações e avaliações', 'acesse pausas emocionais e avaliações')],
    'src/components/TermsPage.tsx': [('artigos, exercícios, meditações, design', 'artigos, exercícios, pausas emocionais, design')],
    'src/components/Articles.tsx': [("item.content_type === 'meditation' ? 'Meditação'", "item.content_type === 'meditation' ? 'Pausa emocional'")],
    'src/components/admin/AdminAIUsage.tsx': [("meditation: 'Meditação'", "meditation: 'Pausa emocional'")],
    'src/components/admin/AdminFabricaIA.tsx': [("['meditation', 'Meditação']", "['meditation', 'Pausa emocional']"), ("tipo === 'meditation' ? 'Meditações'", "tipo === 'meditation' ? 'Pausas emocionais'")],
    'src/components/admin/AdminArticleEditor.tsx': [('<option value=\"meditation\">Meditação</option>', '<option value=\"meditation\">Pausa emocional</option>')],
    'src/components/admin/AdminCalendarioEditorial.tsx': [("meditation: 'Meditação'", "meditation: 'Pausa emocional'"), ('<option value=\"meditation\">Meditação</option>', '<option value=\"meditation\">Pausa emocional</option>')],
    'src/components/admin/AdminAreaConteudo.tsx': [('tipos de conteúdo (artigos, práticas, meditações)', 'tipos de conteúdo (artigos, práticas, pausas emocionais)')],
    'src/components/admin/AdminArticles.tsx': [("meditation: { title: 'Meditações', novo: 'Nova meditação', vazio: 'Nenhuma meditação ainda. Crie um conteúdo e escolha o tipo \\\"Meditação\\\".' }", "meditation: { title: 'Pausas emocionais', novo: 'Nova pausa emocional', vazio: 'Nenhuma pausa emocional ainda. Crie um conteúdo e escolha o tipo \\\"Pausa emocional\\\".' }")],
}
for rel, pairs in changes.items():
    for old, new in pairs:
        replace(rel, old, new)

# Remover os arquivos temporários depois de carregar este script em memória.
Path('.github/workflows/apply-avnc-final-fixes.yml').unlink(missing_ok=True)
Path('.github/scripts/apply_avnc_final_fixes.py').unlink(missing_ok=True)
print('temporary automation files scheduled for deletion')

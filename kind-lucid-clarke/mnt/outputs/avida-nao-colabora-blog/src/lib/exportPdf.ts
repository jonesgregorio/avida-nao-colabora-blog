// Exporta um elemento do DOM para um PDF limpo (multipágina A4).
// jspdf e html2canvas são carregados sob demanda para não pesar o bundle inicial.

export async function exportElementToPdf(el: HTMLElement, filename: string) {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])
  const html2canvas = html2canvasMod.default

  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#FBFAF7',
    useCORS: true,
    logging: false,
  })

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 24
  const imgW = pageW - margin * 2
  const imgH = (canvas.height * imgW) / canvas.width
  const imgData = canvas.toDataURL('image/png')

  // Pagina verticalmente: desloca a imagem para cima a cada página.
  let heightLeft = imgH
  let position = margin
  pdf.addImage(imgData, 'PNG', margin, position, imgW, imgH)
  heightLeft -= (pageH - margin * 2)
  while (heightLeft > 0) {
    position = margin - (imgH - heightLeft)
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', margin, position, imgW, imgH)
    heightLeft -= (pageH - margin * 2)
  }

  pdf.save(filename)
}

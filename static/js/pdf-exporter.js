export function openPdfPrintWindow() {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;

  const sections = [
    { key: 'overview', title: '개요' },
    { key: 'upper', title: '브랜드 인지도' },
    { key: 'mid', title: '고객 획득' },
    { key: 'lower', title: '전환 및 매출' },
    { key: 'survey', title: '설문지' },
    { key: 'panel-stats', title: '패널 통계' },
    { key: 'qa', title: '품질 검증' },
    { key: 'individual', title: '개별 응답' },
  ];

  const renderedSections = sections.map(section => {
    const source = document.getElementById(`tab-${section.key}`);
    if (!source) return '';
    const clone = source.cloneNode(true);
    clone.classList.remove('tab-panel', 'active');
    clone.querySelectorAll('.persona-card').forEach(el => el.classList.add('open'));
    clone.querySelectorAll('.drill-down-header').forEach(el => el.classList.add('open'));
    clone.querySelectorAll('.drill-down-body').forEach(el => el.classList.add('show'));
    clone.querySelectorAll('.raw-content').forEach(el => el.classList.add('show'));
    clone.querySelectorAll('[onclick]').forEach(el => el.removeAttribute('onclick'));
    return `<section class="pdf-report-section"><h2>${section.title}</h2>${clone.innerHTML || '<p>데이터가 없습니다.</p>'}</section>`;
  }).join('');

  const generatedAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Synthetic Panels Report</title>
  <link rel="stylesheet" href="${window.location.origin}/static/app.css" />
  <style>
    :root { color-scheme: light; }
    body { background: #fff; margin: 0; }
    .pdf-report-wrap { max-width: 1120px; margin: 0 auto; padding: 24px 24px 40px; }
    .pdf-report-head { margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; }
    .pdf-report-head h1 { margin: 0; font-size: 1.5rem; }
    .pdf-report-head p { margin: 8px 0 0; color: #6b7280; font-size: 0.9rem; }
    .pdf-report-section { margin: 0 0 28px; page-break-inside: avoid; }
    .pdf-report-section > h2 { margin: 0 0 12px; font-size: 1.08rem; border-left: 4px solid #6c5ce7; padding-left: 10px; }
    .tab-panel, .persona-card-body, .drill-down-body, .raw-content { display: block !important; }
    .tab-hierarchy, .raw-toggle, .chevron { display: none !important; }
    @page { size: A4; margin: 12mm; }
  </style>
</head>
<body>
  <div class="pdf-report-wrap">
    <header class="pdf-report-head">
      <h1>Synthetic Panels 분석 리포트</h1>
      <p>생성 시각: ${generatedAt} (KST)</p>
    </header>
    ${renderedSections}
  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const printNow = () => { printWindow.focus(); printWindow.print(); };
  printWindow.onload = () => setTimeout(printNow, 350);
  return true;
}

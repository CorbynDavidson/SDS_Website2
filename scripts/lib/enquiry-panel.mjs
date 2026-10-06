export function addEnquiryPanel(html,css) {
  // Keep all existing children, copy, form controls and layout classes intact.
  const framed=html.replace(/<header class="service-hero(?=[\s"])/,'<header class="service-hero source-enquiry-panel');
  if(framed===html)throw new Error('The selected enquiry section has no service-hero header.');
  return framed.replace('</head>','<style id="sds-enquiry-panel">'+css+'</style></head>');
}

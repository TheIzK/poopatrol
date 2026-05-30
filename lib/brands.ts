const BRAND_DOMAINS: Record<string, string> = {
  // Major oil brands
  'shell': 'shell.com',
  'bp': 'bp.com',
  'chevron': 'chevron.com',
  'exxon': 'exxon.com',
  'exxonmobil': 'exxon.com',
  'mobil': 'mobil.com',
  'texaco': 'texaco.com',
  'conoco': 'conoco.com',
  '76': '76.com',
  'gulf': 'gulf.com',
  'citgo': 'citgo.com',
  'sunoco': 'sunoco.com',
  'marathon': 'marathonbrand.com',
  'valero': 'valero.com',
  'phillips 66': 'phillips66.com',
  'pure': 'puregas.com',
  'liberty': 'libertygas.com',

  // Travel centers / truck stops
  "love's": 'loves.com',
  'loves': 'loves.com',
  "love's travel stop": 'loves.com',
  'pilot': 'pilotflyingj.com',
  'flying j': 'pilotflyingj.com',
  'pilot flying j': 'pilotflyingj.com',
  'ta': 'ta-petro.com',
  'travel centers of america': 'ta-petro.com',
  'petro': 'ta-petro.com',
  "buc-ee's": 'buc-ees.com',
  'bucees': 'buc-ees.com',
  'sheetz': 'sheetz.com',
  'wawa': 'wawa.com',
  'kwik trip': 'kwiktrip.com',
  'kwik star': 'kwiktrip.com',
  'thorntons': 'thorntons.com',

  // Convenience / big box
  'circle k': 'circlek.com',
  '7-eleven': '7-eleven.com',
  'speedway': 'speedway.com',
  'racetrac': 'racetrac.com',
  'casey\'s': 'caseys.com',
  'caseys': 'caseys.com',
  'murphy usa': 'murphyusa.com',
  'murphy express': 'murphyusa.com',
  'kroger': 'kroger.com',
  'walmart': 'walmart.com',
  'costco': 'costco.com',
  "sam's club": 'samsclub.com',
}

export function getBrandLogoUrl(brand: string | null | undefined): string | null {
  if (!brand) return null
  const domain = BRAND_DOMAINS[brand.toLowerCase().trim()]
  if (!domain) return null
  return `https://logo.clearbit.com/${domain}`
}

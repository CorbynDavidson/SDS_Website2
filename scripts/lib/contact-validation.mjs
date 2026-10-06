import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
const typos = { 'gmial.com':'gmail.com', 'gamil.com':'gmail.com', 'gmai.com':'gmail.com', 'gmail.con':'gmail.com', 'gmail.co':'gmail.com', 'hotmial.com':'hotmail.com', 'hotmal.com':'hotmail.com', 'hotmail.con':'hotmail.com', 'outlok.com':'outlook.com', 'outlook.con':'outlook.com', 'yaho.com':'yahoo.com', 'yahoo.con':'yahoo.com' };
export function validateContact(type, raw) {
  const value = String(raw || '').trim();
  if (!value) return {};
  if (type === 'postcode') {
    const compact=value.toUpperCase().replace(/\s+/g,'');
    if (!/^(?:GIR0AA|[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2})$/.test(compact)) return { error:'Please enter a full UK postcode, for example M1 1AA.' };
    return {value:compact.slice(0,-3)+' '+compact.slice(-3)};
  }
  if (type === 'email') {
    if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { error:'Please enter a valid email address.' };
    const [local, domain] = value.split('@');
    if (!domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return { error:'Please check the email domain after @.' };
    return { value:local+'@'+domain.toLowerCase(), suggestion:typos[domain.toLowerCase()] ? local+'@'+typos[domain.toLowerCase()] : undefined };
  }
  if (type === 'tel') {
    if (!/^[+\d\s().-]+$/.test(value)) return { error:'Please enter a valid phone number, including the country code for an international number.' };
    let input=value.replace(/^00/, '+');
    const number=parsePhoneNumberFromString(input, { defaultCountry:'GB', extract:false });
    if (!number?.isValid()) return { error:'Please check the phone number’s length and prefix. For a UK number, include the initial 0 or +44.' };
    return { value:number.number };
  }
  return {};
}

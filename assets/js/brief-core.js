/* Pure local-brief logic: no network calls, identity state or private project links. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VdsBrief = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const VERSION = 1;
  const STORAGE_KEY = 'vds.local-project-brief.v1';
  const limits = { business:120, name:100, email:254, website:1000, audience:2000, projectType:120, goal:3000, references:3000, language:100, timing:100, readiness:100, notes:4000 };
  const choices = {
    needs:['Business and service information','Customer contact or inquiries','A catalog or portfolio','An internal workflow','Content and updates','Advice on the right approach'],
    style:['Clean and simple','Warm and personal','Bold and expressive','Refined and understated','Playful and approachable','Open to ideas'],
    content:['An existing logo or brand guide','Photos or illustrations','Written content','A list of products or services'],
    projectType:['A new website','Improving an existing website','An app or workflow','I’m still figuring it out'],
    language:['English','Spanish','English and Spanish','Another language — discuss with José'],
    timing:['As soon as practical','Within the next month','In the next few months','No set timeline'],
    readiness:['Just exploring','I have a rough plan','I know what I need','I’d like help defining it']
  };
  function sanitize(input) {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const out = {};
    for (const [key, max] of Object.entries(limits)) { const value = typeof source[key] === 'string' ? source[key].slice(0,max) : ''; out[key] = choices[key] && !choices[key].includes(value) ? '' : value; }
    for (const key of ['needs','style','content']) out[key] = Array.isArray(source[key]) ? [...new Set(source[key].filter(value => choices[key].includes(value)))].slice(0, choices[key].length) : [];
    return out;
  }
  function validateStep(step, value) {
    const a = sanitize(value), errors = {};
    if (step === 0) {
      if (!a.business.trim()) errors.business = 'Add a business or project name to continue.';
      if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) errors.email = 'Use an email address such as name@example.com, or leave it blank.';
      if (a.website) { try { const url = new URL(a.website); if (!['http:','https:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) throw new Error(); } catch { errors.website = 'Use a public website address starting with https://, or leave it blank.'; } }
    }
    if (step === 1) { if (!a.projectType) errors.projectType = 'Choose a project type, including “I’m still figuring it out” if you’re unsure.'; if (!a.goal.trim()) errors.goal = 'Add a sentence about what you’d like this project to help with.'; }
    return errors;
  }
  const sections = [
    {title:'Your business',step:0,fields:[['Business or project','business'],['Your name','name'],['Email','email'],['Current website','website'],['Audience','audience']]},
    {title:'Your goals',step:1,fields:[['Project type','projectType'],['Main goal','goal'],['Possible needs','needs']]},
    {title:'Look & feel',step:2,fields:[['Qualities','style'],['References & preferences','references'],['Language','language']]},
    {title:'The details',step:3,fields:[['Existing content','content'],['Start timing','timing'],['Idea stage','readiness'],['Additional notes','notes']]}
  ];
  const display = value => Array.isArray(value) ? value.length ? value.join(', ') : 'Not specified' : value?.trim() || 'Not specified';
  function toText(value) { const a = sanitize(value); return ['Vasquez Digital Solutions — project brief','LOCAL PREVIEW · Not submitted','',...sections.flatMap(section => [section.title.toUpperCase(),...section.fields.map(([label,key]) => label + ': ' + display(a[key])),'']),'This brief was prepared in a browser-local preview. It has not been sent to VDS or Notion.'].join('\n'); }
  function restore(text) { const saved = JSON.parse(text); if (saved?.version !== VERSION || !saved.answers || typeof saved.answers !== 'object') throw new Error('Unsupported draft'); return {answers:sanitize(saved.answers),step:Number.isInteger(saved.step) ? Math.min(4,Math.max(0,saved.step)) : 0}; }
  function filename(value) { const slug = sanitize(value).business.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60); return (slug || 'vds-project') + '-brief.txt'; }
  return {VERSION,STORAGE_KEY,limits,choices,sanitize,validateStep,sections,display,toText,restore,filename};
});

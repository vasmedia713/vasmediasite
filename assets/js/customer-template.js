export const template = Object.freeze({
  id:'pesmera-synthetic-v1',version:1,customer:'pesmera-fixture',name:'Pesmera guided inventory · synthetic fixture',
  branding:{approved:false,client:null,vdsTrim:null},
  source:{label:'Synthetic test catalog — not Pesmera inventory',checkedAt:'2026-10-09',url:null},
  inventory:[{id:'sample-chair',name:'Sample chair',decision:'unknown',quantity:null,priceCents:null,baseVersion:0,details:''}],
  steps:[
    {title:'Review responsibility',why:'The business decision-maker should review quantities and prices. This fixture does not verify Juan’s identity.',example:'Confirm your responsibility, or leave it unknown.'},
    {title:'Inventory',why:'Available quantities help prevent promising stock that is unavailable. Public catalog data needs owner review.',example:'Use confirm for reviewed values, correct for changes, unknown when unsure, or add a missing item.'},
    {title:'Packages',why:'Package composition explains what a customer receives. Prices are entered in cents to preserve exact amounts.',example:'A sample package can contain two sample chairs. No real price or booking policy is suggested.'},
    {title:'Language and presentation',why:'Your preferred language helps shape the customer experience. Approved fonts, colors and logos still need verification.',example:'Choose English, Spanish, both, or unknown.'},
    {title:'Questions and additional changes',why:'These optional entries go to Jose for follow-up. They never execute inventory or pricing instructions.',example:'Ask a question, describe a missing detail, or request another change.'},
    {title:'Review',why:'Check every answer and unresolved item before submitting a version. You can go back and edit.',example:'A receipt confirms storage only when the destination returns verified evidence.'}
  ]
});

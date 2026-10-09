// Deliberately closed until approved persistent adapters and exact mappings exist.
export default async () => Response.json({error:'CUSTOMER_INTEGRATION_DISABLED',message:'Private drafts, photos and submissions are not connected.'},{status:503,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});

/** Read-only access check. All authority comes from the server's Identity SDK. */
export function createSessionHandler(resolveVerifiedUser, resolveSettings) {
  return async request => {
    const headers = {'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
    const reply = (data,status=200) => Response.json(data,{status,headers});
    if (request.method !== 'GET') return reply({error:'Method not allowed'},405);
    const scope = new URL(request.url).searchParams.get('scope') || 'customer';
    if (!['customer','owner'].includes(scope)) return reply({error:'Unknown access scope'},400);
    try {
      const settings = await resolveSettings();
      if (settings?.providers?.google !== true || settings?.disableSignup !== true) return reply({error:'Invitation-only access is not configured'},503);
      const user = await resolveVerifiedUser();
      if (!user?.id) return reply({error:'Sign-in required'},401);
      const isOwner = Array.isArray(user.roles) && user.roles.includes('owner');
      if (scope === 'owner' && !isOwner) return reply({error:'Owner access is not assigned to this account'},403);
      return reply({id:user.id,email:typeof user.email==='string'?user.email:null,access:isOwner?'owner':'customer'});
    } catch { return reply({error:'Access could not be verified'},503); }
  };
}

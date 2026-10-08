import {getSettings,oauthLogin,handleAuthCallback,getUser,logout,refreshSession,onAuthChange} from '@netlify/identity';

const accessPage = document.querySelector('[data-auth-page]');
const hashParams = new URLSearchParams(location.hash.slice(1));
const callbackKeys = ['access_token','confirmation_token','invite_token','recovery_token','email_change_token'];
const hasCallback = callbackKeys.some(key => hashParams.has(key));
const callbackError = hashParams.has('error') || hashParams.has('error_description');
const safeNotices = {
  invite:'An invitation link alone doesn’t sign you in. Continue with the Google account that was invited. If it can’t complete, email José for help.',
  recovery:'Password recovery isn’t available in this Google-only sign-in page. Continue with your invited Google account, or email José for help.',
  error:'Sign-in wasn’t completed. You can try again with an invited Google account, or email José if you need access.'
};
function takeReturnScope() {
  let scope='customer';
  try {scope=sessionStorage.getItem('vds.auth.return-scope')==='owner'?'owner':'customer';sessionStorage.removeItem('vds.auth.return-scope');} catch {}
  return scope;
}
function returnToAccess() { location.replace('/access/#'+takeReturnScope()); }
const clearAuthHash = () => history.replaceState(null,'',location.pathname+location.search);
const feedback = message => {
  let box = document.getElementById('auth-feedback');
  if (!box) { box=document.createElement('div');box.id='auth-feedback';box.className='wrap notice auth-feedback';box.setAttribute('role','status');document.querySelector('main')?.before(box); }
  box.textContent=message;box.hidden=false;
};
let googleAvailable=false, refreshing=false, checkSerial=0;
async function withTimeout(promise, milliseconds=12000) {
  let timer;
  try {return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Service unavailable')),milliseconds);})]);}
  finally {clearTimeout(timer);}
}
const authStatus = message => document.querySelectorAll('[data-auth-status]').forEach(el => {el.textContent=message;});
const scopes = () => [...document.querySelectorAll('[data-auth-scope]')];
function showUnavailable(message='Google sign-in isn’t available on this site yet.') {
  googleAvailable=false;
  document.querySelectorAll('[data-google-login]').forEach(button=>{button.hidden=true;button.disabled=true;});
  document.querySelectorAll('[data-auth-configuration]').forEach(el=>{el.textContent=message;});
  authStatus('Access is unavailable. Email José to continue your project.');
}
async function serverSession(scope) {
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),12000);
  try { const response=await fetch('/.netlify/functions/session?scope='+scope,{credentials:'same-origin',cache:'no-store',signal:controller.signal}); return {status:response.status,data:response.ok?await response.json():null}; }
  finally {clearTimeout(timeout);}
}
async function updateSession() {
  if (!accessPage || !googleAvailable || refreshing) return;
  refreshing=true; const serial=++checkSerial;
  document.querySelectorAll('[data-session-info]').forEach(el=>{el.hidden=true;});
  try {
    const browserUser=await getUser();
    if (!browserUser) {
      scopes().forEach(panel=>{panel.querySelector('[data-session-info]').hidden=true;panel.querySelector('[data-auth-status]').textContent='Invitation required. Use the Google account invited to VDS.';panel.querySelector('[data-google-login]').hidden=false;panel.querySelector('[data-google-login]').disabled=false;});
      document.querySelectorAll('[data-sign-out],[data-refresh-session]').forEach(button=>{button.hidden=true;});
      return;
    }
    document.querySelectorAll('[data-sign-out],[data-refresh-session]').forEach(button=>{button.hidden=false;});
    for (const panel of scopes()) {
      const result=await serverSession(panel.dataset.authScope);
      if (serial!==checkSerial) return;
      const info=panel.querySelector('[data-session-info]'); const status=panel.querySelector('[data-auth-status]');
      if (result.status===200 && result.data?.id) {
        info.hidden=false; info.querySelector('[data-session-email]').textContent=result.data.email || 'Your invited account';
        info.querySelector('[data-session-access]').textContent=panel.dataset.authScope==='owner'?'Owner access verified by the server.':'Signed in. Account access verified by the server.';
        panel.querySelector('[data-google-login]').hidden=true;
        status.textContent='Project files and the private customer questionnaire are not connected yet.';
      } else {
        info.hidden=true;panel.querySelector('[data-google-login]').hidden=false;panel.querySelector('[data-google-login]').disabled=false;
        status.textContent=result.status===403?'This signed-in account doesn’t have owner access. Contact José if this is unexpected.':result.status===401?'Your session could not be verified. Sign out and sign in again.':'The server couldn’t verify your account. No private access has been granted.';
      }
    }
  } catch { document.querySelectorAll('[data-session-info]').forEach(el=>{el.hidden=true;});document.querySelectorAll('[data-google-login]').forEach(button=>{button.hidden=false;button.disabled=false;});authStatus('Account verification isn’t available right now. No private access has been granted.'); }
  finally {refreshing=false;}
}
async function start() {
  let callback=null;
  try {
    // Mandatory on every page so root-level OAuth and email returns are handled.
    callback=await handleAuthCallback();
    if (callbackError) {clearAuthHash();if (!accessPage) {location.replace('/access/?notice=error');return;}feedback(safeNotices.error);}
    if (callback?.type==='recovery') {await logout();if (!accessPage) {location.replace('/access/?notice=recovery');return;}feedback(safeNotices.recovery);}
    else if (callback?.type==='invite') {if (!accessPage) {location.replace('/access/?notice=invite');return;}feedback(safeNotices.invite);}
    else if (callback && !accessPage) {returnToAccess();return;}
    else if (callback?.user && accessPage) {location.hash=takeReturnScope();}
  } catch {
    if (hasCallback) clearAuthHash();
    if (!accessPage) {location.replace('/access/?notice=error');return;}
    feedback(safeNotices.error);
  }
  if (!accessPage) return;
  const notice=new URLSearchParams(location.search).get('notice');if (safeNotices[notice]) feedback(safeNotices[notice]);
  try {
    const settings=await withTimeout(getSettings());
    if (settings?.providers?.google !== true || settings?.disableSignup !== true) {showUnavailable();return;}
    googleAvailable=true;
    document.querySelectorAll('[data-auth-configuration]').forEach(el=>{el.textContent='Google sign-in · Invitation required';});
    document.querySelectorAll('[data-google-login]').forEach(button=>{button.hidden=false;button.disabled=false;});
    await updateSession();
    onAuthChange(()=>{void updateSession();});
    window.addEventListener('pageshow',event=>{if(event.persisted)void updateSession();});
  } catch {showUnavailable();}
}
document.querySelectorAll('[data-google-login]').forEach(button=>button.addEventListener('click',()=>{
  if (!googleAvailable || button.disabled) return;
  button.disabled=true;authStatus('Opening Google sign-in…');
  try {sessionStorage.setItem('vds.auth.return-scope',button.closest('[data-auth-scope]')?.dataset.authScope==='owner'?'owner':'customer');} catch {}
  try {oauthLogin('google');} catch(error) {
    if (error?.message==='Redirecting to OAuth provider') return;
    button.disabled=false;authStatus('Google sign-in couldn’t start. Please try again or email José.');
  }
}));
document.querySelectorAll('[data-sign-out]').forEach(button=>button.addEventListener('click',async()=>{
  button.disabled=true;
  try {await logout();checkSerial++;refreshing=false;await updateSession();authStatus('Signed out of this website. Your local brief, if saved, remains on this device.');}
  catch {authStatus('Sign-out couldn’t be completed. Please try again before leaving a shared device.');}
  finally {button.disabled=false;}
}));
document.querySelectorAll('[data-refresh-session]').forEach(button=>button.addEventListener('click',async()=>{
  button.disabled=true;
  try {await refreshSession();checkSerial++;refreshing=false;await updateSession();}
  catch {authStatus('Your session couldn’t be refreshed. Sign out and sign in again.');}
  finally {button.disabled=false;}
}));
if (accessPage || hasCallback || callbackError) void start();

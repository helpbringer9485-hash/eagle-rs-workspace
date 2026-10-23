'use strict';
// Retired modules remain dormant so older saved records are preserved during updates.
(function(){
 const byId=id=>document.getElementById(id);
 for(const id of ['groupTelegram','toolCalls','panelCalls','signalDock']){const el=byId(id);if(el&&id!=='signalDock'){el.hidden=true;el.setAttribute('aria-hidden','true');}}
 for(const id of ['statMissedCalls','statTelegram'])byId(id)?.closest('.stat')?.setAttribute('data-retired','true');
 for(const id of ['quickMissedCalls','openTelegramAccounts','addTelegram','telegramDesktop']){const el=byId(id);if(el){el.hidden=true;el.disabled=true;}}
 const provider=byId('prefProviderNotifications');if(provider){provider.checked=false;provider.disabled=true;const row=provider.closest('label');if(row)row.hidden=true;}
 const search=document.querySelector('input[placeholder*="Search WhatsApp"]');if(search)search.placeholder='Find a WhatsApp or Signal account…';
 const header=document.querySelector('#panelAi .panel-kicker');if(header)header.textContent='YOUR CHAT ASSISTANT';
})();

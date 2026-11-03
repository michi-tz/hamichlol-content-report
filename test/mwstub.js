window.TEST = { calls: [], posts: [] };
(function(){
const NS = { 'קובץ':6, 'File':6, 'Special':-1, 'מיוחד':-1, 'המכלול':4, 'קטגוריה':14 };
const NSNAME = { 6:'קובץ', '-1':'מיוחד', 4:'המכלול', 14:'קטגוריה' };
function Title(ns, main){ this.ns=ns; this.main=main; }
Title.prototype.getNamespaceId=function(){return this.ns;};
Title.prototype.getMainText=function(){return this.main;};
Title.prototype.getPrefixedText=function(){return (this.ns? NSNAME[this.ns]+':':'')+this.main;};
Title.prototype.getUrl=function(){return mw.util.getUrl(this.getPrefixedText());};
Title.newFromText=function(t, defNs){ t=String(t).replace(/_/g,' ').trim(); const m=t.match(/^([^:]+):(.+)$/); if(m && NS[m[1]]!==undefined) return new Title(NS[m[1]], m[2][0].toUpperCase()+m[2].slice(1)); return new Title(defNs||0, t); };
Title.newFromImg=function(img){ const src=(img.jquery?img[0]:img).getAttribute('src'); const m=src.match(/\/[a-f0-9]\/[a-f0-9]{2}\/([^\s/]+)$/); return m? new Title(6, decodeURIComponent(m[1]).replace(/_/g,' ')):null; };
const msgs={};
const hooks={};
window.mw = {
  config: { values: window.MWCONFIG, get(k){ return this.values[k]; } },
  messages: { set(o){ Object.assign(msgs,o); } },
  msg(k,...p){ let s=msgs[k]||('<'+k+'>'); p.forEach((v,i)=>{s=s.replace('$'+(i+1),v);}); return s; },
  loader: { using(){ return $.Deferred().resolve().promise(); } },
  log: { error(...a){ console.error('mw.log.error', ...a); } },
  hook(n){ hooks[n]=hooks[n]||$.Callbacks('memory'); return { add(f){hooks[n].add(f);return this;}, fire(...a){hooks[n].fire(...a);return this;} }; },
  user: { isAnon(){ return window.MWCONFIG.wgUserName===null; } },
  Title,
  util: {
    getUrl(t,q){ let u='/wiki/'+encodeURIComponent(t.replace(/ /g,'_')); if(q) u+='?'+new URLSearchParams(q); return u; },
    escapeIdForLink(s){ return s.replace(/ /g,'_'); },
    addPortletLink(p, href, text, id){ const li=$('<li>').attr('id',id).append($('<a>').attr('href',href).text(text)); $('#p-tb ul').append(li); return li[0]; },
  },
  Api: function(){},
};
mw.Api.prototype.get=function(p){ TEST.calls.push(['get',p]);
  if(p.meta==='userinfo') return $.Deferred().resolve({query:{userinfo:{rights: window.RIGHTS, blockid: 0}}}).promise();
  if(p.action==='parse') return $.Deferred().resolve({parse:{sections:[{line:'אלברט איינשטיין',anchor:'אלברט_איינשטיין'},{line:'<a href=\"x\">אלברט איינשטיין</a>',anchor:'אלברט_איינשטיין_2'}]}}).promise();
  return $.Deferred().reject('unknown').promise(); };
mw.Api.prototype.newSection=function(page, sum, text, extra){ TEST.calls.push(['newSection',page,sum,text,extra]); return $.Deferred().resolve({edit:{result:'Success',newrevid:555}}).promise(); };
mw.Api.prototype.getErrorMessage=function(r){ return $('<span>').text(r.error.info); };
})();

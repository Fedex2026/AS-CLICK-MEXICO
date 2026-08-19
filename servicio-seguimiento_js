import { auth, db } from "./firebase-config.js";

import {
  collection, doc, getDoc, onSnapshot, query, where,
  updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const TELEFONO_CABINA = "525519750497";
const state = {
  user:null, folio:"", service:null, serviceId:"",
  request:null, requestId:"", provider:null,
  providerLocation:null, unsubscribeService:null,
  unsubscribeRequest:null, unsubscribeLocation:null,
  rating:0, tags:new Set()
};

const $ = id => document.getElementById(id);
const setText = (id,value) => { const el=$(id); if(el) el.textContent=value ?? ""; };
const setHidden = (id,hidden) => { const el=$(id); if(el) el.hidden=hidden; };

function showError(title,message){
  setHidden("loadingPanel",true);
  setHidden("trackingContent",true);
  setHidden("errorPanel",false);
  setText("errorTitle",title);
  setText("errorMessage",message);
}
function showContent(){
  setHidden("loadingPanel",true);
  setHidden("errorPanel",true);
  setHidden("trackingContent",false);
}

state.folio = new URLSearchParams(location.search).get("folio")?.trim() || "";

if(!state.folio){
  showError("Enlace incompleto","No encontramos el folio del servicio.");
}else{
  onAuthStateChanged(auth,user=>{
    if(!user){
      location.replace("./login.html");
      return;
    }
    state.user=user;
    startTracking();
  });
}

function startTracking(){
  listenService();
  listenRequest();
  bindActions();
  restorePendingWhatsApp();
}

function listenService(){
  const q=query(collection(db,"servicios"),where("folio","==",state.folio));
  state.unsubscribeService=onSnapshot(q,snapshot=>{
    const serviceDoc=snapshot.docs.find(item=>{
      const d=item.data();
      return d.usuarioId===state.user.uid || d.uid===state.user.uid;
    });
    if(!serviceDoc){
      if(!snapshot.empty) showError("Acceso no autorizado","Este servicio no pertenece a tu cuenta.");
      return;
    }
    state.serviceId=serviceDoc.id;
    state.service={id:serviceDoc.id,...serviceDoc.data()};
    renderAll(); showContent();
  },error=>{
    console.error("Error leyendo servicio:",error);
    showError("No fue posible cargar el servicio","Revisa tu conexión e inténtalo nuevamente.");
  });
}

function listenRequest(){
  const q=query(collection(db,"solicitudes"),where("folio","==",state.folio));
  state.unsubscribeRequest=onSnapshot(q,snapshot=>{
    const requestDoc=snapshot.docs.find(item=>{
      const d=item.data();
      return d.uidCliente===state.user.uid || d.usuarioId===state.user.uid || d.uid===state.user.uid;
    });
    if(!requestDoc) return;
    const previousProvider=state.request?.asignacion?.uidProveedor || "";
    state.requestId=requestDoc.id;
    state.request={id:requestDoc.id,...requestDoc.data()};
    const providerUid=state.request.asignacion?.uidProveedor || "";
    if(providerUid && providerUid!==previousProvider){
      loadProvider(providerUid); listenProviderLocation();
    }else if(providerUid && !state.unsubscribeLocation){
      listenProviderLocation();
    }
    renderAll(); showContent();
  },error=>console.error("Error leyendo solicitud:",error));
}

async function loadProvider(uid){
  try{
    const snap=await getDoc(doc(db,"proveedores",uid));
    if(snap.exists()){
      state.provider={id:snap.id,...snap.data()};
      renderProvider();
    }
  }catch(error){
    console.warn("No fue posible leer el perfil completo del proveedor:",error);
  }
}

function listenProviderLocation(){
  if(!state.requestId) return;
  state.unsubscribeLocation?.();
  const ref=doc(db,"solicitudes",state.requestId,"seguimiento","ubicacionProveedor");
  state.unsubscribeLocation=onSnapshot(ref,snap=>{
    state.providerLocation=snap.exists()?snap.data():null;
    renderProviderLocation();
  },error=>console.warn("No fue posible leer ubicación del proveedor:",error));
}

function renderAll(){
  if(!state.service && !state.request) return;
  const source=state.request || state.service;
  const service=state.service || source;
  setText("serviceFolio",source.folio || service.folio || state.folio);
  setText("serviceType",getServiceName(source));
  setText("serviceSubtype",source.tipoAuxilio || source.servicio?.tipoAuxilio || service.tipoAuxilio || "");
  const created=source.creadoEn || source.fechaCreacion || service.creadoEn || service.fechaCreacion;
  setText("requestDate",`Solicitado: ${formatDate(created)}`);
  renderStatus(); renderProgress(); renderProvider(); renderSummary();
  renderProviderLocation(); renderArrivalConfirmation(); renderRating();
}

function getServiceName(data){
  return data?.servicio?.nombre || data?.servicio || data?.tipoServicio || "Servicio";
}
function normalizeServiceType(value){
  const text=String(value||"").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").replace(/[\s-]+/g,"_");
  if(text.includes("grua")) return "grua";
  if(text.includes("auxilio")) return "auxilio_vial";
  if(text.includes("ajustador")) return "ajustador";
  if(text.includes("abogado")) return "abogado";
  return text;
}
function getCurrentState(){
  return String(state.request?.estado || state.service?.estado || "solicitado")
    .trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"_");
}

function renderStatus(){
  const status=getCurrentState();
  const map={
    solicitado:["SOLICITUD RECIBIDA","Tu solicitud ya está registrada."],
    pendiente_cabina:["BUSCANDO PROVEEDOR","Estamos buscando al proveedor más cercano."],
    asignado:["PROVEEDOR ASIGNADO","Tu proveedor fue asignado."],
    aceptado:["PROVEEDOR ASIGNADO","Tu proveedor aceptó el servicio."],
    en_camino:["EN CAMINO","Tu proveedor va en camino a tu ubicación."],
    arribo:["LLEGÓ CONTIGO","El proveedor reportó su llegada."],
    en_sitio:["EN SERVICIO","Tu proveedor está atendiendo el servicio."],
    en_proceso:["EN SERVICIO","Tu servicio se encuentra en proceso."],
    en_traslado:["EN TRASLADO","Tu vehículo va rumbo al destino."],
    destino:["EN DESTINO","La grúa llegó al destino registrado."],
    finalizado:["FINALIZADO","Tu servicio fue finalizado."],
    cancelado:["CANCELADO","El servicio fue cancelado."],
    cancelada:["CANCELADO","El servicio fue cancelado."]
  };
  const value=map[status] || [status.replace(/_/g," ").toUpperCase(),"Seguimiento actualizado."];
  setText("currentStatus",value[0]); setText("currentStatusText",value[1]);
  const badge=$("currentStatus");
  if(badge) badge.dataset.state=["cancelado","cancelada"].includes(status)?"cancelado":status;
}

function renderProgress(){
  const source=state.request || state.service || {};
  const type=normalizeServiceType(source.servicio?.tipo || source.tipoServicio || state.service?.tipoServicio || getServiceName(source));
  const isTow=type==="grua";
  document.querySelectorAll(".towOnly").forEach(el=>el.hidden=!isTow);
  const status=getCurrentState();
  const order=isTow
    ?["solicitado","asignado","en_camino","arribo","en_traslado","destino","finalizado"]
    :["solicitado","asignado","en_camino","arribo","finalizado"];
  const normalized=status==="pendiente_cabina"?"solicitado":status==="aceptado"?"asignado":
    (status==="en_sitio"||status==="en_proceso")?"arribo":status;
  const currentIndex=order.indexOf(normalized);
  document.querySelectorAll(".progressStep").forEach(step=>{
    if(step.hidden) return;
    const idx=order.indexOf(step.dataset.step);
    step.classList.toggle("done",currentIndex>idx || normalized==="finalizado");
    step.classList.toggle("active",currentIndex===idx && normalized!=="finalizado");
  });
  const children=Array.from($("progressTrack")?.children||[]).filter(el=>!el.hidden);
  let activeReached=false;
  children.forEach(child=>{
    if(child.classList.contains("progressStep")){
      if(child.classList.contains("active") || (!child.classList.contains("done")&&!child.classList.contains("active"))) activeReached=true;
    }else if(child.classList.contains("progressLine")){
      child.classList.toggle("done",!activeReached);
    }
  });
  setText("timeSolicitado",formatTime(source.creadoEn||source.fechaCreacion||state.service?.creadoEn||state.service?.fechaCreacion));
  setText("timeAsignado",formatTime(source.fechaAsignacion||source.asignadoEn));
  setText("timeEnCamino",formatTime(source.fechaEnCamino));
  setText("timeArribo",formatTime(source.fechaArribo));
  setText("timeTraslado",formatTime(source.fechaInicioTraslado));
  setText("timeDestino",formatTime(source.fechaLlegadaDestino));
  setText("timeFinalizado",formatTime(source.fechaFinalizacion||source.finalizadoEn||state.service?.fechaFinalizacion||state.service?.finalizadoEn));
}

function renderProvider(){
  const assignment=state.request?.asignacion || {};
  const uid=assignment.uidProveedor || "";
  if(!uid){
    setHidden("providerWaiting",false); setHidden("providerInfo",true);
    setHidden("providerVerifiedBadge",true); setText("providerWaitingTitle","Esperando asignación");
    return;
  }
  setHidden("providerWaiting",true); setHidden("providerInfo",false);
  setHidden("providerVerifiedBadge",false); setText("providerWaitingTitle","Proveedor asignado");
  const provider=state.provider || {};
  const name=assignment.nombreProveedor||provider.nombre||provider.nombreCompleto||"Proveedor AS CLICK";
  setText("providerName",name);
  const rating=Number(provider.calificacion??provider.rating??5);
  setText("providerRating",Number.isFinite(rating)?rating.toFixed(1):"5.0");
  const completed=provider.serviciosRealizados??provider.totalServicios??"";
  setText("providerServices",completed?`(${completed} servicios)`:"");
  const photo=assignment.fotoProveedor||provider.foto||provider.fotoURL||provider.photoURL||"";
  const img=$("providerPhoto"),placeholder=$("providerPhotoPlaceholder");
  if(photo&&img){
    img.src=photo; img.hidden=false; if(placeholder) placeholder.hidden=true;
    img.onerror=()=>{img.hidden=true;if(placeholder) placeholder.hidden=false;};
  }else{
    if(img) img.hidden=true;
    if(placeholder){placeholder.hidden=false;placeholder.textContent=String(name).trim().charAt(0).toUpperCase()||"AS";}
  }
  const phone=assignment.telefonoProveedor||provider.telefono||provider.celular||"";
  const digits=String(phone).replace(/\D/g,"");
  const call=$("callProviderButton"),wa=$("whatsappProviderButton");
  if(call) call.href=digits?`tel:+${digits}`:"#";
  if(wa) wa.href=digits?`https://wa.me/${digits}`:"#";
  const unit=provider.unidad||provider.vehiculo||{};
  setText("providerUnit",unit.tipoUnidad||unit.tipo||provider.tipoUnidad||"Unidad AS CLICK");
  const unitDetails=[
    unit.marca||provider.marcaUnidad,
    unit.modelo||provider.modeloUnidad,
    unit.placas||provider.placas||provider.placasUnidad,
    unit.numeroEconomico||unit.economico||provider.numeroEconomico||provider.economico
  ].filter(Boolean);
  setText("providerUnitDetails",unitDetails.length?unitDetails.join(" · "):"Datos de unidad por confirmar");
  const eta=assignment.tiempoEstimadoMinutos;
  setText("etaValue",Number.isFinite(Number(eta))?`${Number(eta)} min`:"Calculando");
  const distance=state.request?.distanciaProveedorKm;
  setText("distanceValue",Number.isFinite(Number(distance))?`${Number(distance).toFixed(1)} km`:"Calculando");
  setText("securityCode",getSecurityCode(state.folio));
}

function renderProviderLocation(){
  const location=state.providerLocation;
  const lat=Number(location?.latitud??location?.latitude);
  const lng=Number(location?.longitud??location?.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)){
    setHidden("mapWaiting",false); setHidden("mapContainer",true); setHidden("openProviderMapButton",true); return;
  }
  setHidden("mapWaiting",true); setHidden("mapContainer",false); setHidden("openProviderMapButton",false);
  const maps=`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const embed=`https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  const iframe=$("providerMap"); if(iframe&&iframe.src!==embed) iframe.src=embed;
  const open=$("openProviderMapButton"); if(open) open.href=maps;
  setText("locationUpdatedAt",`Actualizado ${formatTime(location.actualizadoEn)}`);
  const distance=state.request?.distanciaProveedorKm;
  setText("mapDistanceText",Number.isFinite(Number(distance))?`A ${Number(distance).toFixed(1)} km de ti`:"Ubicación actualizada");
}

function renderSummary(){
  const service=state.service||{},request=state.request||{},vehicle=request.vehiculo||service.vehiculo||{};
  const origin=request.ubicacion?.enlaceGoogleMaps||service.ubicacion||service.ubicacionDatos?.enlaceGoogleMaps||"Ubicación registrada";
  setText("originText",String(origin).startsWith("http")?"Ubicación compartida por el cliente":origin);
  const vehicleName=[vehicle.marca,vehicle.subMarca||vehicle.submarca,vehicle.color,vehicle.placas].filter(Boolean).join(" · ");
  setText("vehicleText",vehicleName||"Vehículo por confirmar");
  const tow=request.datosGrua||service.datosGrua||null;
  const type=normalizeServiceType(request.servicio?.tipo||request.tipoServicio||service.tipoServicio||getServiceName(request));
  const isTow=type==="grua";
  setHidden("destinationRow",!isTow); setHidden("towDetails",!isTow);
  if(isTow){
    setText("destinationText",tow?.destino||"Por confirmar");
    setText("towCondition",tow?.condicion||"No registrado");
    setText("towReleased",tow?.liberado||"No registrado");
    setText("towLoad",tow?.tieneCarga||"No registrado");
  }
}

function renderArrivalConfirmation(){
  const status=getCurrentState();
  const confirmed=state.service?.clienteConfirmoArribo===true||state.request?.clienteConfirmoArribo===true;
  setHidden("arrivalConfirmCard",status!=="arribo"||confirmed);
}
function renderRating(){
  const status=getCurrentState(),existing=state.service?.calificacion;
  if(existing?.estrellas){
    setHidden("ratingCard",false); setText("ratingFeedback","Gracias. Tu calificación ya fue registrada.");
    setHidden("ratingFeedback",false); const b=$("submitRatingButton"); if(b) b.hidden=true; return;
  }
  setHidden("ratingCard",status!=="finalizado");
}

function bindActions(){
  $("shareTrackingButton")?.addEventListener("click",shareTracking);
  $("cancelServiceButton")?.addEventListener("click",cancelService);
  $("helpButton")?.addEventListener("click",openHelp);
  $("helpHeaderButton")?.addEventListener("click",openHelp);
  $("reportProblemButton")?.addEventListener("click",reportProblem);
  $("confirmArrivalButton")?.addEventListener("click",confirmArrival);
  $("notSeenButton")?.addEventListener("click",()=>{
    setText("arrivalFeedback","Entendido. Espera a tener al proveedor a la vista antes de confirmar.");
    setHidden("arrivalFeedback",false);
  });
  document.querySelectorAll("#starSelector button").forEach(button=>button.addEventListener("click",()=>{
    state.rating=Number(button.dataset.stars); renderStars();
  }));
  document.querySelectorAll("#ratingTags button").forEach(button=>button.addEventListener("click",()=>{
    const tag=button.dataset.tag;
    if(state.tags.has(tag)){state.tags.delete(tag);button.classList.remove("active");}
    else{state.tags.add(tag);button.classList.add("active");}
  }));
  $("submitRatingButton")?.addEventListener("click",submitRating);
}

function renderStars(){
  document.querySelectorAll("#starSelector button").forEach(button=>{
    button.classList.toggle("active",Number(button.dataset.stars)<=state.rating);
  });
  const submit=$("submitRatingButton"); if(submit) submit.disabled=state.rating<1;
}

async function confirmArrival(){
  if(!state.serviceId) return;
  const payload={clienteConfirmoArribo:true,fechaConfirmacionArriboCliente:serverTimestamp()};
  const ops=[updateDoc(doc(db,"servicios",state.serviceId),payload)];
  if(state.requestId) ops.push(updateDoc(doc(db,"solicitudes",state.requestId),payload));
  const results=await Promise.allSettled(ops);
  if(results[0].status==="rejected"){
    setText("arrivalFeedback","No fue posible guardar la confirmación.");setHidden("arrivalFeedback",false);return;
  }
  setText("arrivalFeedback","Llegada confirmada. Gracias.");setHidden("arrivalFeedback",false);setHidden("arrivalConfirmCard",true);
}

function cancelService(){
  const status=getCurrentState();
  if(["finalizado","cancelado","cancelada"].includes(status)){alert("Este servicio ya no puede cancelarse.");return;}
  if(!confirm("¿Deseas solicitar la cancelación del servicio?\n\nIMPORTANTE: Después de 15 minutos de haber solicitado el servicio se cobrará el 50% del costo.")) return;
  const message=["*SOLICITUD DE CANCELACIÓN AS CLICK*","","⚠ Después de 15 minutos de haber solicitado el servicio se cobrará el 50% del costo.","",`Folio: ${state.folio}`,`Servicio: ${getServiceName(state.request||state.service)}`,`Estado actual: ${$("currentStatus")?.textContent||status}`,"","Solicito la cancelación de este servicio."].join("\n");
  window.open(`https://wa.me/${TELEFONO_CABINA}?text=${encodeURIComponent(message)}`,"_blank","noopener,noreferrer");
  const payload={cancelacionSolicitada:true,fechaSolicitudCancelacion:serverTimestamp()};
  if(state.serviceId) updateDoc(doc(db,"servicios",state.serviceId),payload).catch(console.warn);
  if(state.requestId) updateDoc(doc(db,"solicitudes",state.requestId),payload).catch(console.warn);
}
function openHelp(){
  const message=["Hola, necesito ayuda con un servicio de AS CLICK.","",`Folio: ${state.folio}`,`Estado: ${$("currentStatus")?.textContent||getCurrentState()}`].join("\n");
  window.open(`https://wa.me/${TELEFONO_CABINA}?text=${encodeURIComponent(message)}`,"_blank","noopener,noreferrer");
}
function reportProblem(){
  const message=["*REPORTE DE PROBLEMA AS CLICK*","",`Folio: ${state.folio}`,`Servicio: ${getServiceName(state.request||state.service)}`,`Estado: ${$("currentStatus")?.textContent||getCurrentState()}`,"","Problema:"].join("\n");
  window.open(`https://wa.me/${TELEFONO_CABINA}?text=${encodeURIComponent(message)}`,"_blank","noopener,noreferrer");
}
async function shareTracking(){
  const url=location.href;
  if(navigator.share){
    try{await navigator.share({title:`Seguimiento AS CLICK ${state.folio}`,text:"Seguimiento de mi servicio AS CLICK",url});return;}
    catch(error){if(error?.name==="AbortError") return;}
  }
  try{await navigator.clipboard.writeText(url);alert("Enlace de seguimiento copiado.");}
  catch{prompt("Copia este enlace de seguimiento:",url);}
}

async function submitRating(){
  if(!state.serviceId||state.rating<1) return;
  const button=$("submitRatingButton"); if(button){button.disabled=true;button.textContent="Guardando...";}
  const rating={estrellas:state.rating,comentario:$("ratingComment")?.value?.trim()||"",etiquetas:Array.from(state.tags),fecha:serverTimestamp(),uidCliente:state.user.uid};
  const ops=[updateDoc(doc(db,"servicios",state.serviceId),{calificacion:rating,calificado:true})];
  if(state.requestId) ops.push(updateDoc(doc(db,"solicitudes",state.requestId),{calificacionCliente:rating}));
  const results=await Promise.allSettled(ops);
  if(results[0].status==="rejected"){
    setText("ratingFeedback","No fue posible guardar la calificación. Inténtalo nuevamente.");setHidden("ratingFeedback",false);
    if(button){button.disabled=false;button.textContent="Enviar calificación";}return;
  }
  setText("ratingFeedback","Gracias. Tu calificación fue enviada.");setHidden("ratingFeedback",false);
  if(button){button.textContent="Calificación enviada";button.disabled=true;}
}

function restorePendingWhatsApp(){
  try{
    const pending=sessionStorage.getItem("asClickWhatsAppPendiente");
    if(!pending) return;
    const button=$("openPendingWhatsappButton");if(button) button.href=pending;
    setHidden("whatsappPendingCard",false);
    button?.addEventListener("click",()=>{
      sessionStorage.removeItem("asClickWhatsAppPendiente");
      setHidden("whatsappPendingCard",true);
    },{once:true});
  }catch(error){console.warn("No fue posible recuperar el enlace de WhatsApp:",error);}
}

function getSecurityCode(folio){
  const digits=String(folio||"").replace(/\D/g,"");
  return digits.slice(-4).padStart(4,"0");
}
function formatDate(value){
  const date=toDate(value);if(!date) return "Pendiente";
  return date.toLocaleString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function formatTime(value){
  const date=toDate(value);if(!date) return "—";
  return date.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"});
}
function toDate(value){
  if(!value) return null;
  if(typeof value.toDate==="function") return value.toDate();
  if(value instanceof Date) return value;
  if(typeof value?.seconds==="number") return new Date(value.seconds*1000);
  const date=new Date(value);return Number.isNaN(date.getTime())?null:date;
}
addEventListener("beforeunload",()=>{
  state.unsubscribeService?.();state.unsubscribeRequest?.();state.unsubscribeLocation?.();
});

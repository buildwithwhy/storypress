import {X} from 'lucide-react';

// One presentational confirm dialog on the app's existing modal styling. It
// replaces the native confirm() on draft import, sign-out and invite revoke,
// and renders the consent-gated device-draft offer at sign-in (device-draft
// privacy): a question, an optional draft preview, one primary and one
// secondary action.
export function ConfirmDialog({title,body,detail,confirmLabel,cancelLabel,onConfirm,onCancel}:{title:string;body?:string;detail?:string;confirmLabel:string;cancelLabel:string;onConfirm:()=>void;onCancel:()=>void;}){
 return <div className="modal-backdrop no-print" onClick={onCancel}><section className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onClick={e=>e.stopPropagation()}>
  <button className="icon-button close" aria-label={cancelLabel} onClick={onCancel}><X size={21}/></button>
  <h2 id="confirm-dialog-title">{title}</h2>
  {body&&<p>{body}</p>}
  {detail&&<p className="confirm-detail">{detail}</p>}
  <div className="sharing-actions"><button className="primary" onClick={onConfirm}>{confirmLabel}</button><button className="secondary" onClick={onCancel}>{cancelLabel}</button></div>
 </section></div>;
}

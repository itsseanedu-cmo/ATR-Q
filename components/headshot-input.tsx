'use client';
import {useEffect,useRef,useState} from 'react';
import {MAX_HEADSHOT_LENGTH} from '../lib/player-profile';

export function HeadshotInput({value,onChange,onWorkingChange}:{
  value:string;onChange:(photo:string)=>void;onWorkingChange?:(working:boolean)=>void;
}) {
  const [error,setError]=useState('');
  const [working,setWorking]=useState(false);
  const uploadId=useRef(0);
  useEffect(()=>()=>{uploadId.current++;onWorkingChange?.(false);},[onWorkingChange]);
  async function upload(file?:File) {
    if(!file)return;
    setError('');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10000000){
      setError('Choose a JPG, PNG or WebP photo under 10 MB.');
      return;
    }
    const id=++uploadId.current;
    setWorking(true);onWorkingChange?.(true);
    let url='';
    try{
      url=URL.createObjectURL(file);
      const image=new Image();
      image.src=url;
      await image.decode();
      const canvas=document.createElement('canvas');
      canvas.width=480;
      canvas.height=480;
      const context=canvas.getContext('2d');
      if(!context)throw Error('Photo processing is unavailable.');
      context.fillStyle='white';
      context.fillRect(0,0,480,480);
      const size=Math.min(image.width,image.height);
      context.drawImage(image,(image.width-size)/2,(image.height-size)/2,size,size,0,0,480,480);
      let photo=canvas.toDataURL('image/jpeg',0.78);
      if(photo.length>MAX_HEADSHOT_LENGTH)photo=canvas.toDataURL('image/jpeg',0.55);
      if(photo.length>MAX_HEADSHOT_LENGTH)throw Error('Try a simpler or smaller headshot.');
      if(id===uploadId.current)onChange(photo);
    }catch(e){if(id===uploadId.current)setError(e instanceof Error?e.message:'Unable to load this photo.');}
    finally{if(url)URL.revokeObjectURL(url);if(id===uploadId.current){setWorking(false);onWorkingChange?.(false);}}
  }
  return <div className="headshot-picker">
    {value&&<img src={value} alt="Headshot preview"/>}
    <label className="field">Headshot (optional)
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={working} onChange={e=>{void upload(e.target.files?.[0]);e.currentTarget.value='';}}/>
    </label>
    {value&&<button type="button" className="text-btn" disabled={working} onClick={()=>onChange('')}>Remove photo</button>}
    {working&&<p role="status">Preparing photo…</p>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}

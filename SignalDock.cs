using System;using System.Diagnostics;using System.Runtime.InteropServices;using System.Text;using System.Web.Script.Serialization;using System.Collections.Generic;
[assembly:System.Reflection.AssemblyTitle("EAGLE RS Signal Dock")]
[assembly:System.Reflection.AssemblyProduct("EAGLE RS Workspace")]
[assembly:System.Reflection.AssemblyVersion("3.25.0.0")]
[assembly:System.Reflection.AssemblyFileVersion("3.25.0.0")]
class SignalDock {
 [DllImport("user32.dll")] static extern bool EnumWindows(Func<IntPtr,IntPtr,bool> cb,IntPtr p);
 [DllImport("user32.dll")] static extern bool IsWindow(IntPtr w);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr w,out uint pid);
 [DllImport("user32.dll")] static extern int GetWindowText(IntPtr w,StringBuilder s,int n);
 [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr w);
 [DllImport("user32.dll",SetLastError=true)] static extern IntPtr SetParent(IntPtr w,IntPtr p);
 [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr w,int i);
 [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr w,int i,int v);
 [DllImport("user32.dll")] static extern bool MoveWindow(IntPtr w,int x,int y,int width,int height,bool repaint);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr w,int mode);
 class Saved {public IntPtr window,parent;public int style;}
 static Dictionary<string,Saved> saved=new Dictionary<string,Saved>();static JavaScriptSerializer json=new JavaScriptSerializer();
 static bool Signal(IntPtr w){uint pid;GetWindowThreadProcessId(w,out pid);try{return Process.GetProcessById((int)pid).ProcessName.Equals("Signal",StringComparison.OrdinalIgnoreCase);}catch{return false;}}
 static void Detach(Saved s){if(!IsWindow(s.window))return;ShowWindow(s.window,0);SetParent(s.window,s.parent);SetWindowLong(s.window,-16,s.style);ShowWindow(s.window,5);}
 static object Run(Dictionary<string,object> a){string op=Convert.ToString(a["op"]);if(op=="list"){var windows=new List<object>();EnumWindows((w,p)=>{if(Signal(w)&&GetParent(w)==IntPtr.Zero){var text=new StringBuilder(512);GetWindowText(w,text,512);if(text.Length>0)windows.Add(new{handle=w.ToInt64().ToString(),title=text.ToString()});}return true;},IntPtr.Zero);return new{ok=true,windows=windows};}
 if(op=="hide"){foreach(var s in saved.Values)ShowWindow(s.window,0);return new{ok=true};}
 if(op=="detachAll"){foreach(var s in saved.Values)Detach(s);saved.Clear();return new{ok=true};}
 string slot=Convert.ToString(a["slot"]);
 if(op=="attach"){var w=new IntPtr(Convert.ToInt64(a["handle"]));var parent=new IntPtr(Convert.ToInt64(a["parent"]));if(!IsWindow(parent)||!IsWindow(w)||!Signal(w))throw new Exception("Choose an existing Signal window.");uint parentPid;GetWindowThreadProcessId(parent,out parentPid);if(parentPid!=(uint)Convert.ToInt32(a["ownerPid"]))throw new Exception("Workspace window changed.");foreach(var pair in saved)if(pair.Key!=slot&&pair.Value.window==w)throw new Exception("That Signal window is already assigned to another account.");if(saved.ContainsKey(slot))Detach(saved[slot]);var s=new Saved{window=w,parent=GetParent(w),style=GetWindowLong(w,-16)};ShowWindow(w,0);SetWindowLong(w,-16,(s.style&~unchecked((int)0x80C40000))|0x40000000);SetParent(w,parent);if(GetParent(w)!=parent){SetWindowLong(w,-16,s.style);ShowWindow(w,5);throw new Exception("Windows rejected Signal docking.");}saved[slot]=s;return new{ok=true};}
 if(op=="show"){foreach(var pair in saved)if(pair.Key!=slot)ShowWindow(pair.Value.window,0);if(!saved.ContainsKey(slot))return new{ok=false,message="Connect this account to a Signal window first."};var s=saved[slot];if(!IsWindow(s.window)){saved.Remove(slot);return new{ok=false,message="Signal window closed. Connect it again."};}MoveWindow(s.window,Convert.ToInt32(a["x"]),Convert.ToInt32(a["y"]),Convert.ToInt32(a["width"]),Convert.ToInt32(a["height"]),true);ShowWindow(s.window,5);return new{ok=true};}
 if(op=="detach"){if(saved.ContainsKey(slot)){Detach(saved[slot]);saved.Remove(slot);}return new{ok=true};}throw new Exception("Unknown dock command.");}
 static void Main(){try{string line;while((line=Console.ReadLine())!=null){try{var a=json.Deserialize<Dictionary<string,object>>(line);Console.WriteLine(json.Serialize(Run(a)));}catch(Exception e){Console.WriteLine(json.Serialize(new{ok=false,message=e.Message}));}}}finally{foreach(var s in saved.Values)Detach(s);}}
}

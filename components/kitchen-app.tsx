"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bell, Camera, Check, ChevronRight, CircleAlert, Clock3, CookingPot,
  Home, Leaf, Minus, PackageOpen, Plus, ReceiptText, Search,
  Settings, ShoppingBasket, SlidersHorizontal, Snowflake, Sparkles, Sprout,
  ThermometerSnowflake, Trash2, X,
} from "lucide-react";
import type { InventoryLot } from "@/lib/domain";
import { assertCanConsume, riskScore } from "@/lib/domain";

type View = "home" | "inventory" | "receipt" | "recipes" | "shopping" | "waste" | "settings";
type ShopItem = { id: string; name: string; amount: string; checked: boolean; source: string };
type ReceiptResult = {
  storeName: string | null;
  purchasedAt: string | null;
  total: number | null;
  items: Array<{
    name: string;
    normalizedName: string;
    quantity: number;
    unit: InventoryLot["unit"];
    price: number | null;
    category: "ingredient" | "seasoning" | "daily_goods" | "unknown";
    confidence: number;
  }>;
  warnings: string[];
  mismatch: boolean;
  contentHash: string;
};

const initialLots: InventoryLot[] = [
  { id:"lot-cabbage", name:"キャベツ", category:"野菜", quantity:420, unit:"g", storage:"冷蔵", expiresIn:1, expiryType:"消費期限", opened:true, price:198 },
  { id:"lot-tofu", name:"木綿豆腐", category:"大豆製品", quantity:300, unit:"g", storage:"冷蔵", expiresIn:2, expiryType:"消費期限", opened:false, price:88 },
  { id:"lot-pork", name:"豚こま肉", category:"肉", quantity:240, unit:"g", storage:"冷凍", expiresIn:9, expiryType:"賞味期限", opened:false, price:348 },
  { id:"lot-egg", name:"卵", category:"卵・乳製品", quantity:4, unit:"個", storage:"冷蔵", expiresIn:5, expiryType:"賞味期限", opened:false, price:168 },
  { id:"lot-onion", name:"玉ねぎ", category:"野菜", quantity:2, unit:"個", storage:"常温", expiresIn:12, expiryType:"賞味期限", opened:false, price:116 },
  { id:"lot-miso", name:"味噌", category:"調味料", quantity:310, unit:"g", storage:"冷蔵", expiresIn:null, expiryType:"未設定", opened:true, price:278 },
  { id:"lot-rice", name:"米", category:"主食", quantity:1.8, unit:"kg", storage:"常温", expiresIn:null, expiryType:"未設定", opened:true, price:1280 },
];

const recipes = [
  { id:"r1", name:"豚とキャベツの香味蒸し", emoji:"🥬", tone:"from-[#dceccf] to-[#f7edd5]", time:15, score:94, use:"キャベツ 200g", missing:"買い足しなし", tags:["期限優先","節約"], needs:[{lot:"lot-cabbage", qty:200},{lot:"lot-pork",qty:160}] },
  { id:"r2", name:"豆腐と卵のとろみ丼", emoji:"🍳", tone:"from-[#fae4b8] to-[#f8f1df]", time:12, score:89, use:"豆腐 300g", missing:"片栗粉 小さじ1", tags:["使い切り","時短"], needs:[{lot:"lot-tofu",qty:300},{lot:"lot-egg",qty:1}] },
  { id:"r3", name:"ごろごろ野菜のみそ汁", emoji:"🥣", tone:"from-[#f2cda9] to-[#e9edcd]", time:18, score:82, use:"3食材を同時消費", missing:"買い足しなし", tags:["作り置き"], needs:[{lot:"lot-cabbage",qty:120},{lot:"lot-onion",qty:1}] },
];

const nav = [
  {id:"home" as View,label:"ホーム",icon:Home},{id:"inventory" as View,label:"在庫",icon:PackageOpen},
  {id:"receipt" as View,label:"レシート",icon:ReceiptText},{id:"recipes" as View,label:"レシピ",icon:CookingPot},
  {id:"shopping" as View,label:"買い物",icon:ShoppingBasket},
];
const extra = [{id:"waste" as View,label:"食品ロス対策",icon:Leaf},{id:"settings" as View,label:"設定",icon:Settings}];

export function KitchenApp() {
  const [view,setView] = useState<View>("home");
  const [lots,setLots] = useState(initialLots);
  const [shopping,setShopping] = useState<ShopItem[]>([
    {id:"s1",name:"片栗粉",amount:"1袋",checked:false,source:"豆腐と卵のとろみ丼"},
    {id:"s2",name:"牛乳",amount:"1本",checked:false,source:"手動で追加"},
    {id:"s3",name:"食器用洗剤",amount:"1個",checked:true,source:"日用品"},
  ]);
  const [toast,setToast] = useState("");
  const [cookId,setCookId] = useState<string | null>(null);
  const flash=(message:string)=>{setToast(message); window.setTimeout(()=>setToast(""),2600)};
  const cook = (id:string) => {
    const recipe=recipes.find(r=>r.id===id)!;
    try {
      const next=lots.map(l=>{
        const need=recipe.needs.find(n=>n.lot===l.id); if(!need) return l;
        return {...l,quantity:assertCanConsume(l.quantity,need.qty)};
      });
      setLots(next); setCookId(null); flash(`「${recipe.name}」の使用量を在庫へ反映しました`);
    } catch(e) { flash(e instanceof Error ? e.message : "在庫を更新できませんでした"); }
  };
  const urgent=useMemo(()=>lots.filter(l=>l.expiresIn!==null&&l.expiresIn>=0&&l.expiresIn<=3).sort((a,b)=>riskScore(b)-riskScore(a)),[lots]);
  return <div className="min-h-screen bg-[#f4f3ee] text-[#173a2f]">
    <Sidebar view={view} setView={setView}/>
    <div className="md:pl-[224px]">
      <Header view={view}/>
      <main className="mx-auto max-w-[1320px] px-4 pb-28 pt-5 sm:px-7 lg:px-10 lg:pt-8">
        {view==="home"&&<Dashboard urgent={urgent} setView={setView} setCookId={setCookId} shopping={shopping} setShopping={setShopping}/>}
        {view==="inventory"&&<Inventory lots={lots} setLots={setLots} flash={flash}/>}
        {view==="receipt"&&<Receipt setLots={setLots} flash={flash}/>}
        {view==="recipes"&&<Recipes setCookId={setCookId}/>}
        {view==="shopping"&&<Shopping items={shopping} setItems={setShopping}/>}
        {view==="waste"&&<Waste lots={lots}/>}
        {view==="settings"&&<Preferences flash={flash}/>}
      </main>
    </div>
    <MobileNav view={view} setView={setView}/>
    {toast&&<div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#173e31] px-5 py-3 text-sm font-bold text-white shadow-xl md:bottom-6">✓ {toast}</div>}
    {cookId&&<CookModal recipe={recipes.find(r=>r.id===cookId)!} lots={lots} close={()=>setCookId(null)} complete={()=>cook(cookId)}/>}
  </div>;
}

function Sidebar({view,setView}:{view:View;setView:(v:View)=>void}) {
  return <aside className="fixed inset-y-0 left-0 z-30 hidden w-[224px] flex-col border-r border-[#d9ddd4] bg-[#fbfaf6] px-4 py-6 md:flex">
    <button onClick={()=>setView("home")} className="mb-9 flex items-center gap-3 px-2 text-left" aria-label="ホームへ">
      <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#226449] text-white"><Sprout size={22}/></span>
      <span><b className="block text-xl tracking-tight">mottainAI</b><small className="text-[10px] font-bold tracking-[.14em] text-[#789086]">FOOD CYCLE</small></span>
    </button>
    <p className="mb-2 px-3 text-[10px] font-black tracking-[.16em] text-[#8a998f]">メニュー</p>
    <nav className="space-y-1">{nav.map(item=><NavButton key={item.id} {...item} active={view===item.id} click={()=>setView(item.id)}/>)}</nav>
    <div className="my-5 border-t border-[#e4e5df]"/>
    <nav className="space-y-1">{extra.map(item=><NavButton key={item.id} {...item} active={view===item.id} click={()=>setView(item.id)}/>)}</nav>
    <div className="mt-auto rounded-2xl bg-[#e7f0e9] p-4">
      <div className="mb-2 flex items-center justify-between text-xs font-bold"><span>今月の削減</span><Leaf size={16}/></div>
      <div className="text-2xl font-black">1.8 kg</div><p className="mt-1 text-[11px] text-[#577267]">先月より 24% 改善</p>
    </div>
  </aside>;
}
function NavButton({label,icon:Icon,active,click}:{label:string;icon:typeof Home;active:boolean;click:()=>void}){return <button onClick={click} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active?"bg-[#dfece2] text-[#17563d]":"text-[#5f736b] hover:bg-[#f0f0ea]"}`}><Icon size={19}/>{label}{active&&<span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#2c7253]"/>}</button>}

function Header({view}:{view:View}) { const titles:Record<View,string>={home:"今日のキッチン",inventory:"在庫管理",receipt:"レシート登録",recipes:"レシピ",shopping:"買い物リスト",waste:"食品ロス対策",settings:"生活条件・設定"}; return <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#d9ddd4]/80 bg-[#f4f3ee]/90 px-4 backdrop-blur-xl sm:px-7 lg:px-10"><div className="flex items-center gap-3 md:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#226449] text-white"><Sprout size={19}/></span><b>mottainAI</b></div><h1 className="hidden text-sm font-extrabold md:block">{titles[view]}</h1><div className="flex items-center gap-2"><span className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#648074] shadow-sm sm:flex"><span className="h-2 w-2 rounded-full bg-[#4ea86f]"/>デモデータ</span><button aria-label="通知" className="relative grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm"><Bell size={18}/><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-white bg-[#ed765f]"/></button><span className="grid h-9 w-9 place-items-center rounded-full bg-[#f2c99b] text-sm font-black">Y</span></div></header>}

function Dashboard({urgent,setView,setCookId,shopping,setShopping}:{urgent:InventoryLot[];setView:(v:View)=>void;setCookId:(id:string)=>void;shopping:ShopItem[];setShopping:(v:ShopItem[])=>void}) {
  return <div className="space-y-6">
    <section className="rise flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-1 text-sm font-bold text-[#698076]">10月17日 土曜日</p><h2 className="text-[clamp(1.75rem,4vw,2.6rem)] font-black tracking-[-.04em]">おはようございます。</h2><p className="mt-1 text-[#667b72]">今日は、冷蔵庫の <b className="text-[#d15f4a]">2つの食材</b> を優先しましょう。</p></div><button onClick={()=>setView("receipt")} className="flex items-center justify-center gap-2 rounded-2xl bg-[#235f46] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#1c5d3e]/15 transition hover:-translate-y-0.5"><Camera size={18}/>レシートを読み取る</button></section>
    <section className="rise delay-1 relative overflow-hidden rounded-[28px] bg-[#193f32] p-6 text-white shadow-[0_18px_50px_rgba(27,66,52,.16)] sm:p-8">
      <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full border-[45px] border-white/[.04]"/><div className="absolute bottom-[-60px] right-32 h-40 w-40 rounded-full bg-[#e7b86a]/10"/>
      <div className="relative grid gap-7 lg:grid-cols-[1.12fr_.88fr] lg:items-center"><div><span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4c871] px-3 py-1 text-[11px] font-black tracking-wide text-[#294234]"><Sparkles size={13}/>今日の使い切りチャンス</span><h3 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">キャベツと豆腐、<br/>おいしいうちに使いませんか？</h3><p className="mt-3 max-w-lg text-sm leading-6 text-[#c8d8d0]">この2品を一緒に使えば、ロスリスクを約68%下げられます。買い足しなしの献立があります。</p><div className="mt-5 flex flex-wrap gap-3"><button onClick={()=>setView("recipes")} className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#194230]">レシピを見る</button><button onClick={()=>setView("waste")} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold">理由を確認</button></div></div>
        <div className="grid grid-cols-2 gap-3">{urgent.slice(0,2).map((l,i)=><div key={l.id} className="rounded-2xl border border-white/10 bg-white/[.08] p-4 backdrop-blur"><div className="mb-5 flex items-start justify-between"><span className="text-4xl">{i===0?"🥬":"⬜"}</span><span className="rounded-full bg-[#f9d4a4] px-2 py-1 text-[10px] font-black text-[#744523]">あと {l.expiresIn}日</span></div><b>{l.name}</b><div className="mt-1 text-xs text-[#bdd0c7]">残り {l.quantity}{l.unit} · {l.storage}</div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#f4c871]" style={{width:`${Math.max(18,riskScore(l))}%`}}/></div></div>)}</div>
      </div>
    </section>
    <div className="grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
      <section className="rise delay-2 rounded-[24px] border border-[#dedfd8] bg-[#fbfaf6] p-5 sm:p-6"><Title eyebrow="おすすめ" title="今日つくれるレシピ" action="すべて見る" onClick={()=>setView("recipes")}/><div className="mt-5 grid gap-4 sm:grid-cols-2">{recipes.slice(0,2).map(r=><RecipeCard key={r.id} recipe={r} cook={()=>setCookId(r.id)}/>)}</div></section>
      <section className="rise delay-3 rounded-[24px] border border-[#dedfd8] bg-[#fbfaf6] p-5 sm:p-6"><Title eyebrow="ストレージ" title="保管場所の使用量"/><div className="mt-6 space-y-6"><Gauge icon={ThermometerSnowflake} label="冷蔵庫" value={68} color="#347b5c"/><Gauge icon={Snowflake} label="冷凍庫" value={42} color="#5f91a5"/><Gauge icon={PackageOpen} label="常温" value={31} color="#c99055"/></div><p className="mt-6 rounded-xl bg-[#f0eee7] px-3 py-2 text-[11px] leading-5 text-[#6e7d76]">容量は食材カテゴリからの推定値です。正確な容積ではありません。</p></section>
    </div>
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="rounded-[24px] border border-[#dedfd8] bg-[#fbfaf6] p-5 lg:col-span-2"><Title eyebrow="期限アラート" title="早めに使いたい食材" action="在庫を開く" onClick={()=>setView("inventory")}/><div className="mt-4 divide-y divide-[#e5e5de]">{urgent.map(l=><div key={l.id} className="flex items-center gap-3 py-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9efe4] text-xl">{l.name.includes("キャベツ")?"🥬":"▫️"}</span><div className="min-w-0 flex-1"><b className="text-sm">{l.name}</b><p className="text-xs text-[#74847d]">{l.quantity}{l.unit} · {l.storage} · {l.opened?"開封済み":"未開封"}</p></div><span className="rounded-full bg-[#fff0e7] px-2.5 py-1 text-xs font-black text-[#bc5d45]">あと{l.expiresIn}日</span></div>)}</div></section>
      <section className="rounded-[24px] border border-[#dedfd8] bg-[#fbfaf6] p-5"><Title eyebrow="買い物" title="次に買うもの" action="開く" onClick={()=>setView("shopping")}/><div className="mt-4 space-y-2">{shopping.slice(0,3).map(item=><label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-1 py-2"><input type="checkbox" className="sr-only" checked={item.checked} onChange={()=>setShopping(shopping.map(s=>s.id===item.id?{...s,checked:!s.checked}:s))}/><span className={`grid h-5 w-5 place-items-center rounded-md border ${item.checked?"border-[#397655] bg-[#397655] text-white":"border-[#b9c2bd]"}`}>{item.checked&&<Check size={13}/>}</span><span className={`flex-1 text-sm font-bold ${item.checked?"text-[#9aa59f] line-through":""}`}>{item.name}</span><span className="text-xs text-[#7a8982]">{item.amount}</span></label>)}</div></section>
    </div>
  </div>;
}

function Title({eyebrow,title,action,onClick}:{eyebrow:string;title:string;action?:string;onClick?:()=>void}){return <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black tracking-[.16em] text-[#789087]">{eyebrow}</p><h3 className="mt-1 text-lg font-black tracking-tight">{title}</h3></div>{action&&<button onClick={onClick} className="flex items-center text-xs font-black text-[#2b6e50]">{action}<ChevronRight size={15}/></button>}</div>}
function Gauge({icon:Icon,label,value,color}:{icon:typeof Home;label:string;value:number;color:string}){return <div><div className="mb-2 flex items-center gap-2 text-sm font-bold"><Icon size={17}/><span className="flex-1">{label}</span><span>{value}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-[#e5e6df]"><div className="h-full rounded-full" style={{width:`${value}%`,background:color}}/></div></div>}
function RecipeCard({recipe,cook}:{recipe:(typeof recipes)[number];cook:()=>void}){return <article className="overflow-hidden rounded-[20px] border border-[#dedfd8] bg-white"><div className={`relative grid h-32 place-items-center bg-gradient-to-br ${recipe.tone}`}><span className="text-6xl drop-shadow-sm">{recipe.emoji}</span><span className="absolute right-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-black text-[#285a44]">適合度 {recipe.score}%</span></div><div className="p-4"><div className="flex flex-wrap gap-1.5">{recipe.tags.map(t=><span key={t} className="rounded-full bg-[#e9f1e8] px-2 py-0.5 text-[10px] font-bold text-[#47705d]">{t}</span>)}</div><h4 className="mt-2 font-black">{recipe.name}</h4><div className="mt-2 flex items-center gap-4 text-xs text-[#72827b]"><span className="flex items-center gap-1"><Clock3 size={14}/>{recipe.time}分</span><span>{recipe.use}</span></div><div className="mt-3 flex items-center justify-between"><span className="text-[11px] font-bold text-[#537265]">{recipe.missing}</span><button onClick={cook} className="rounded-lg bg-[#245e46] px-3 py-2 text-xs font-black text-white">調理する</button></div></div></article>}

function Inventory({lots,setLots,flash}:{lots:InventoryLot[];setLots:(v:InventoryLot[])=>void;flash:(s:string)=>void}){
  const [query,setQuery]=useState(""); const [storage,setStorage]=useState("すべて"); const [adding,setAdding]=useState(false);
  const filtered=lots.filter(l=>l.name.includes(query)&&(storage==="すべて"||l.storage===storage));
  return <section className="space-y-5"><PageIntro kicker="INVENTORY" title="いまある食材" desc={`${lots.length}種類・購入ロットごとに期限と残量を管理しています。`} action={<button onClick={()=>setAdding(true)} className="flex items-center gap-2 rounded-xl bg-[#235f46] px-4 py-2.5 text-sm font-black text-white"><Plus size={17}/>手動で追加</button>}/><div className="flex flex-col gap-3 rounded-2xl border border-[#dedfd8] bg-[#fbfaf6] p-3 sm:flex-row"><label className="flex flex-1 items-center gap-2 rounded-xl bg-[#efefe9] px-3"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="食材名を検索" className="h-11 flex-1 bg-transparent text-sm outline-none"/></label><select value={storage} onChange={e=>setStorage(e.target.value)} className="h-11 rounded-xl border border-[#dedfd8] bg-white px-4 text-sm font-bold"><option>すべて</option><option>冷蔵</option><option>冷凍</option><option>常温</option></select><button className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#dedfd8] bg-white px-4 text-sm font-bold"><SlidersHorizontal size={16}/>期限順</button></div><div className="grid gap-3">{filtered.map(l=><article key={l.id} className="flex flex-col gap-4 rounded-2xl border border-[#dedfd8] bg-[#fbfaf6] p-4 sm:flex-row sm:items-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e7eee4] text-2xl">{l.category==="野菜"?"🥬":l.category==="肉"?"🥩":l.category==="主食"?"🍚":l.category==="調味料"?"🫙":"🥚"}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-black">{l.name}</h3>{l.opened&&<span className="rounded bg-[#fff0df] px-1.5 py-0.5 text-[10px] font-bold text-[#99612f]">開封済み</span>}</div><p className="mt-1 text-xs text-[#73837c]">ロット {l.id.replace("lot-","").toUpperCase()} · {l.category} · {l.storage}</p></div><div className="grid grid-cols-2 gap-6 sm:text-right"><div><p className="text-[10px] font-bold text-[#829088]">残量</p><p className="font-black">{l.quantity}<small className="ml-0.5">{l.unit}</small></p></div><div><p className="text-[10px] font-bold text-[#829088]">期限</p><p className={`text-sm font-black ${l.expiresIn!==null&&l.expiresIn<=2?"text-[#c45c45]":""}`}>{l.expiresIn===null?"未設定":`あと${l.expiresIn}日`}</p></div></div><button aria-label={`${l.name}を削除`} onClick={()=>{setLots(lots.filter(x=>x.id!==l.id));flash(`${l.name}を削除しました`)}} className="self-end rounded-lg p-2 text-[#9aaaa3] hover:bg-[#f8e8e3] hover:text-[#ba5c48]"><Trash2 size={17}/></button></article>)}{!filtered.length&&<Empty title="該当する食材がありません" text="検索条件を変えてみてください。"/>}</div>{adding&&<AddLot close={()=>setAdding(false)} add={(lot)=>{setLots([lot,...lots]);setAdding(false);flash("在庫に追加しました")}}/>}</section>
}

function Receipt({setLots,flash}:{setLots:React.Dispatch<React.SetStateAction<InventoryLot[]>>;flash:(s:string)=>void}){
  const input=useRef<HTMLInputElement>(null); const [file,setFile]=useState<File|null>(null); const [result,setResult]=useState<ReceiptResult|null>(null); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const scan=async()=>{
    if(!file){flash("画像を選択してください");return}
    setLoading(true); setError(""); setResult(null);
    try {
      const body=new FormData(); body.append("image",file);
      const response=await fetch("/api/receipts/analyze",{method:"POST",body});
      const data=await response.json() as ReceiptResult|{error?:string;code?:string};
      if(!response.ok){
        const message="code" in data&&data.code==="AI_UNAVAILABLE"?"Gemini APIキーが未設定です。.env.local を確認してください。":"error" in data&&data.error?data.error:"レシートを解析できませんでした";
        throw new Error(message);
      }
      setResult(data as ReceiptResult);
    } catch(e) { setError(e instanceof Error?e.message:"レシートを解析できませんでした"); }
    finally { setLoading(false); }
  };
  const updateItem=(index:number,patch:Partial<ReceiptResult["items"][number]>)=>setResult(current=>current?{...current,items:current.items.map((item,i)=>i===index?{...item,...patch}:item)}:current);
  const register=()=>{
    if(!result)return;
    const food=result.items.filter(item=>item.category!=="daily_goods");
    if(!food.length){flash("在庫に登録できる食品がありません");return}
    const now=Date.now();
    const lots:InventoryLot[]=food.map((item,index)=>({id:`lot-${now}-${index}`,name:item.normalizedName.trim()||item.name.trim(),category:item.category==="seasoning"?"調味料":item.category==="ingredient"?"食材":"その他",quantity:item.quantity,unit:item.unit,storage:item.category==="seasoning"?"常温":"冷蔵",expiresIn:null,expiryType:"未設定",opened:false,price:item.price??0}));
    setLots(prev=>[...lots,...prev]);
    const skipped=result.items.length-food.length;
    flash(`${lots.length}品を在庫に登録しました${skipped?`（日用品${skipped}品は除外）`:""}`);
    setResult(null); setFile(null); setError(""); if(input.current)input.current.value="";
  };
  return <section className="space-y-5"><PageIntro kicker="RECEIPT SCAN" title="買ったものを在庫へ" desc="画像は解析時だけ送信します。期限が読めない場合は、勝手に補完しません。"/><div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><div className="rounded-[24px] border border-[#dedfd8] bg-[#fbfaf6] p-5"><button onClick={()=>input.current?.click()} className="grid min-h-[310px] w-full place-items-center rounded-2xl border-2 border-dashed border-[#b8c7bd] bg-[#edf2ec] p-6 text-center transition hover:bg-[#e7eee6]"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-[#28674c] shadow-sm"><Camera size={28}/></span><b className="mt-4 block">レシートを撮影・選択</b><p className="mt-2 text-xs leading-5 text-[#718078]">JPEG / PNG / WebP・最大10MB<br/>ピントが合った画像を使ってください</p>{file&&<span className="mt-4 inline-block max-w-full truncate rounded-full bg-white px-3 py-1.5 text-xs font-bold">{file.name}</span>}</div></button><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={e=>{setFile(e.target.files?.[0]??null);setResult(null);setError("")}}/><button onClick={scan} disabled={loading||!file} className="mt-3 w-full rounded-xl bg-[#235f46] py-3 text-sm font-black text-white disabled:opacity-50">{loading?"Geminiで解析しています…":"Geminiで読み取る"}</button>{error&&<p role="alert" className="mt-3 rounded-xl bg-[#fff0e9] p-3 text-xs font-bold leading-5 text-[#a64f3e]">{error}</p>}</div><div className="rounded-[24px] border border-[#dedfd8] bg-[#fbfaf6] p-5 sm:p-6"><Title eyebrow="確認してから登録" title="読み取り結果"/>{!result?<Empty icon={ReceiptText} title={loading?"解析中です":"まだ読み取っていません"} text={loading?"商品名・数量・金額を抽出しています。":"画像を選ぶと、商品名・数量・金額を確認できます。"}/>:<div className="mt-5"><div className="mb-4 flex flex-wrap justify-between gap-2 rounded-xl bg-[#f0eee7] p-3 text-xs"><span>{result.storeName??"店舗名不明"}{result.purchasedAt?` · ${result.purchasedAt}`:""}</span><b>{result.total===null?"合計不明":`合計 ¥${result.total.toLocaleString()}`}</b></div>{(result.mismatch||result.warnings.length>0)&&<div className="mb-3 rounded-xl bg-[#fff6e5] p-3 text-xs leading-5 text-[#896027]">{result.mismatch&&<p className="flex items-center gap-1 font-bold"><CircleAlert size={13}/>明細と合計金額が一致しません。登録前に確認してください。</p>}{result.warnings.map(w=><p key={w}>・{w}</p>)}</div>}<div className="divide-y divide-[#e3e3dc]">{result.items.map((item,idx)=><div key={`${item.name}-${idx}`} className="grid grid-cols-[minmax(0,1fr)_70px_82px] items-end gap-2 py-3"><label className="text-xs text-[#73837c]">商品名<input value={item.normalizedName} onChange={e=>updateItem(idx,{normalizedName:e.target.value})} className="mt-1 w-full rounded-lg border border-[#daddd5] bg-white px-2 py-2 text-sm font-bold text-[#173a2f]"/></label><label className="text-xs text-[#73837c]">数量<input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e=>updateItem(idx,{quantity:Number(e.target.value)})} className="mt-1 w-full rounded-lg border border-[#daddd5] bg-white px-2 py-2 text-sm"/></label><label className="text-xs text-[#73837c]">単位<select value={item.unit} onChange={e=>updateItem(idx,{unit:e.target.value as InventoryLot["unit"]})} className="mt-1 w-full rounded-lg border border-[#daddd5] bg-white px-2 py-2 text-sm">{["g","kg","ml","L","個","本","袋","枚","パック"].map(unit=><option key={unit}>{unit}</option>)}</select></label><label className="col-span-2 text-xs text-[#73837c]">金額<input type="number" min="0" value={item.price??""} placeholder="不明" onChange={e=>updateItem(idx,{price:e.target.value===""?null:Number(e.target.value)})} className="mt-1 w-full rounded-lg border border-[#daddd5] bg-white px-2 py-2 text-sm"/></label><span className={`rounded-full px-2 py-2 text-center text-[10px] font-black ${item.confidence<.7?"bg-[#fff0df] text-[#99612f]":"bg-[#e7f0e9] text-[#47705d]"}`}>{item.category==="daily_goods"?"日用品":`${Math.round(item.confidence*100)}%`}</span>{item.confidence<.7&&<span className="col-span-3 flex items-center gap-1 text-[10px] font-bold text-[#9a6b33]"><CircleAlert size={12}/>読み取り精度が低いため、内容を確認してください。</span>}</div>)}</div><p className="mt-3 text-[10px] font-bold text-[#7a8982]">期限はすべて未設定で登録します。日用品は在庫登録から除外します。</p><button onClick={register} disabled={!result.items.some(item=>item.category!=="daily_goods"&&item.normalizedName.trim()&&item.quantity>0)} className="mt-5 w-full rounded-xl bg-[#235f46] py-3 text-sm font-black text-white disabled:opacity-50">食品 {result.items.filter(item=>item.category!=="daily_goods").length}品を在庫に登録</button></div>}</div></div></section>
}

function Recipes({setCookId}:{setCookId:(id:string)=>void}){return <section className="space-y-5"><PageIntro kicker="SMART RECIPES" title="在庫を活かす献立" desc="期限・使い切り量・買い足し・調理時間をルールで採点しています。" action={<button className="flex items-center gap-2 rounded-xl bg-[#235f46] px-4 py-2.5 text-sm font-black text-white"><Sparkles size={17}/>AIで新しく生成</button>}/><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{recipes.map(r=><div key={r.id}><RecipeCard recipe={r} cook={()=>setCookId(r.id)}/><div className="-mt-2 rounded-b-2xl border border-t-0 border-[#dedfd8] bg-[#edf2ec] px-4 pb-3 pt-4 text-xs"><b>スコアの理由</b><ul className="mt-1 space-y-1 text-[#60766c]"><li>+ 期限が近い食材を優先</li><li>+ {r.use}</li><li>+ {r.missing}</li></ul></div></div>)}</div></section>}

function Shopping({items,setItems}:{items:ShopItem[];setItems:(i:ShopItem[])=>void}){const [value,setValue]=useState("");const add=()=>{if(!value.trim())return;setItems([{id:`s${Date.now()}`,name:value.trim(),amount:"1個",checked:false,source:"手動で追加"},...items]);setValue("")};return <section className="space-y-5"><PageIntro kicker="SHOPPING LIST" title="必要なものだけ買う" desc={`${items.filter(i=>!i.checked).length}件が未購入。在庫を増やすのはレシート登録後です。`}/><div className="mx-auto max-w-3xl rounded-[24px] border border-[#dedfd8] bg-[#fbfaf6] p-5 sm:p-7"><div className="flex gap-2"><input value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="牛乳、洗剤などを追加" className="h-12 flex-1 rounded-xl border border-[#daddd5] bg-white px-4 outline-none focus:border-[#397655]"/><button onClick={add} className="grid h-12 w-12 place-items-center rounded-xl bg-[#235f46] text-white"><Plus/></button></div><div className="mt-5 divide-y divide-[#e1e2db]">{items.map(item=><div key={item.id} className="flex items-center gap-3 py-4"><button onClick={()=>setItems(items.map(i=>i.id===item.id?{...i,checked:!i.checked}:i))} className={`grid h-6 w-6 place-items-center rounded-lg border ${item.checked?"border-[#397655] bg-[#397655] text-white":"border-[#acb9b2]"}`}>{item.checked&&<Check size={15}/>}</button><div className="flex-1"><b className={item.checked?"text-[#9da7a2] line-through":""}>{item.name}</b><p className="mt-0.5 text-[11px] text-[#85928c]">{item.source}</p></div><span className="rounded-lg bg-[#eeeee8] px-2.5 py-1 text-xs font-bold">{item.amount}</span><button onClick={()=>setItems(items.filter(i=>i.id!==item.id))} aria-label="削除" className="text-[#9aa69f]"><X size={17}/></button></div>)}</div></div></section>}

function Waste({lots}:{lots:InventoryLot[]}){const ranked=lots.map(l=>({...l,risk:riskScore(l)})).filter(l=>l.risk>=0).sort((a,b)=>b.risk-a.risk);return <section className="space-y-5"><PageIntro kicker="FOOD WASTE" title="捨てないための見通し" desc="期限そのものと、消費ペースから見たロス推定を分けて表示します。"/><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><div className="rounded-[24px] bg-[#193f32] p-6 text-white"><Leaf size={24}/><p className="mt-8 text-sm text-[#bcd0c7]">今月の推定削減量</p><p className="mt-1 text-4xl font-black">1.8 <small className="text-lg">kg</small></p><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/10 p-3"><small>削減できた金額</small><b className="mt-1 block text-xl">¥2,140</b></div><div className="rounded-xl bg-white/10 p-3"><small>使い切り率</small><b className="mt-1 block text-xl">86%</b></div></div></div><div className="rounded-[24px] border border-[#dedfd8] bg-[#fbfaf6] p-5"><Title eyebrow="リスク推定" title="優先順位と理由"/><div className="mt-4 space-y-3">{ranked.slice(0,4).map(l=><div key={l.id} className="rounded-xl border border-[#e1e2db] bg-white p-3"><div className="flex items-center justify-between"><b>{l.name}</b><span className={`rounded-full px-2 py-1 text-[10px] font-black ${l.risk>65?"bg-[#fee7df] text-[#b6533f]":"bg-[#eef0e6] text-[#64765c]"}`}>ロスリスク {l.risk}%</span></div><p className="mt-1 text-xs text-[#75857e]">{l.expiresIn===null?"期限未設定のため予測対象外":`残量 ${l.quantity}${l.unit}・期限まで${l.expiresIn}日${l.opened?"・開封済み":""}`}</p></div>)}</div></div></div><div className="rounded-2xl border border-[#efd9b6] bg-[#fff8e9] p-4 text-sm leading-6"><b>安全について：</b> リスク表示は食品ロスの可能性の推定で、食べられるかどうかの判定ではありません。期限表示・保存状態・においや見た目を確認してください。</div></section>}

function Preferences({flash}:{flash:(s:string)=>void}){return <section className="space-y-5"><PageIntro kicker="PREFERENCES" title="暮らしに合わせる" desc="固定の生活スタイルを押しつけず、あとからいつでも変更できます。"/><form onSubmit={e=>{e.preventDefault();flash("設定を保存しました")}} className="grid gap-5 lg:grid-cols-2"><SettingsCard title="食費と買い物"><Field label="1週間の食費予算"><input type="number" defaultValue="7000"/><span>円</span></Field><Field label="買い物頻度"><select defaultValue="週2回"><option>週1回</option><option>週2回</option><option>週3回以上</option></select></Field><Field label="1回の調理時間"><select defaultValue="30分以内"><option>15分以内</option><option>30分以内</option><option>60分以内</option></select></Field></SettingsCard><SettingsCard title="食事の好みと安全"><Field label="1食あたりの人数"><input type="number" defaultValue="1"/><span>人</span></Field><label className="block text-sm font-bold">アレルギー<input placeholder="例：えび、落花生（未設定）" className="mt-2 h-11 w-full rounded-xl border border-[#daddd5] bg-white px-3 font-normal"/></label><label className="block text-sm font-bold">苦手な食材<input placeholder="例：パクチー" className="mt-2 h-11 w-full rounded-xl border border-[#daddd5] bg-white px-3 font-normal"/></label></SettingsCard><SettingsCard title="保管場所"><Gauge icon={ThermometerSnowflake} label="冷蔵庫の目安" value={68} color="#347b5c"/><Gauge icon={Snowflake} label="冷凍庫の目安" value={42} color="#5f91a5"/></SettingsCard><SettingsCard title="通知"><label className="flex items-center justify-between text-sm font-bold">期限アラート<span className="relative h-7 w-12 rounded-full bg-[#397655] before:absolute before:right-1 before:top-1 before:h-5 before:w-5 before:rounded-full before:bg-white"/></label><Field label="何日前に知らせる"><input type="number" defaultValue="3"/><span>日前</span></Field></SettingsCard><button className="rounded-xl bg-[#235f46] py-3 text-sm font-black text-white lg:col-span-2">設定を保存</button></form></section>}
function SettingsCard({title,children}:{title:string;children:React.ReactNode}){return <section className="space-y-5 rounded-[24px] border border-[#dedfd8] bg-[#fbfaf6] p-5 sm:p-6"><h3 className="font-black">{title}</h3>{children}</section>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="flex items-center gap-2 text-sm font-bold"><span className="flex-1">{label}</span><span className="flex h-11 items-center gap-2 rounded-xl border border-[#daddd5] bg-white px-3 [&_input]:w-20 [&_input]:bg-transparent [&_input]:text-right [&_input]:outline-none [&_select]:bg-transparent [&_select]:outline-none">{children}</span></label>}

function PageIntro({kicker,title,desc,action}:{kicker:string;title:string;desc:string;action?:React.ReactNode}){return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black tracking-[.18em] text-[#70877d]">{kicker}</p><h2 className="mt-1 text-3xl font-black tracking-[-.04em]">{title}</h2><p className="mt-2 text-sm text-[#6d8077]">{desc}</p></div>{action}</div>}
function Empty({icon:Icon=PackageOpen,title,text}:{icon?:typeof Home;title:string;text:string}){return <div className="grid min-h-52 place-items-center text-center"><div><Icon className="mx-auto text-[#9daf9f]" size={30}/><b className="mt-3 block text-sm">{title}</b><p className="mt-1 text-xs text-[#849189]">{text}</p></div></div>}

function AddLot({close,add}:{close:()=>void;add:(l:InventoryLot)=>void}){const [name,setName]=useState("");return <div className="fixed inset-0 z-50 grid place-items-end bg-[#0e281f]/45 p-3 sm:place-items-center"><form onSubmit={e=>{e.preventDefault();if(name.trim())add({id:`lot-${Date.now()}`,name:name.trim(),category:"その他",quantity:1,unit:"個",storage:"冷蔵",expiresIn:null,expiryType:"未設定",opened:false,price:0})}} className="w-full max-w-md rounded-[24px] bg-[#fbfaf6] p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-lg font-black">在庫を手動で追加</h3><button type="button" onClick={close}><X/></button></div><label className="mt-5 block text-sm font-bold">食材名<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="例：にんじん" className="mt-2 h-12 w-full rounded-xl border border-[#daddd5] bg-white px-4 outline-none"/></label><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-bold">数量<input type="number" defaultValue="1" min="0.01" step="0.01" className="mt-2 h-11 w-full rounded-xl border border-[#daddd5] px-3"/></label><label className="text-sm font-bold">保存場所<select className="mt-2 h-11 w-full rounded-xl border border-[#daddd5] bg-white px-3"><option>冷蔵</option><option>冷凍</option><option>常温</option></select></label></div><p className="mt-3 text-xs text-[#78887f]">期限は「未設定」で登録し、後から追加できます。</p><button className="mt-5 w-full rounded-xl bg-[#235f46] py-3 text-sm font-black text-white">追加する</button></form></div>}

function CookModal({recipe,lots,close,complete}:{recipe:(typeof recipes)[number];lots:InventoryLot[];close:()=>void;complete:()=>void}){return <div className="fixed inset-0 z-50 grid place-items-end bg-[#0e281f]/50 p-3 sm:place-items-center"><div className="w-full max-w-lg rounded-[26px] bg-[#fbfaf6] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-black tracking-[.15em] text-[#71867c]">使用量の確認</p><h3 className="mt-1 text-xl font-black">{recipe.name}</h3></div><button onClick={close}><X/></button></div><p className="mt-2 text-sm leading-6 text-[#718078]">実際に使う量を確認してください。完了するとロットごとの在庫と履歴を一度だけ更新します。</p><div className="mt-5 divide-y divide-[#e0e1da]">{recipe.needs.map(n=>{const lot=lots.find(l=>l.id===n.lot)!;return <div key={n.lot} className="flex items-center gap-3 py-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8eee6]">{lot.category==="肉"?"🥩":lot.name==="卵"?"🥚":"🥬"}</span><div className="flex-1"><b className="text-sm">{lot.name}</b><p className="text-[11px] text-[#809087]">使用元: {lot.id}・残り{lot.quantity}{lot.unit}</p></div><div className="flex items-center rounded-lg border border-[#daddd5] bg-white"><button className="p-2 text-[#73847c]"><Minus size={14}/></button><b className="min-w-14 text-center text-sm">{n.qty}{lot.unit}</b><button className="p-2 text-[#73847c]"><Plus size={14}/></button></div></div>})}</div><div className="mt-5 flex gap-3"><button onClick={close} className="flex-1 rounded-xl border border-[#cfd5d1] py-3 text-sm font-bold">戻る</button><button onClick={complete} className="flex-[1.5] rounded-xl bg-[#235f46] py-3 text-sm font-black text-white">この量で調理完了</button></div></div></div>}

function MobileNav({view,setView}:{view:View;setView:(v:View)=>void}){return <nav className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-[20px] border border-white/70 bg-[#fbfaf6]/95 px-2 py-2 shadow-[0_12px_45px_rgba(26,50,42,.2)] backdrop-blur md:hidden">{nav.map(item=>{const Icon=item.icon;return <button key={item.id} onClick={()=>setView(item.id)} className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[9px] font-black ${view===item.id?"bg-[#dfece2] text-[#1d6044]":"text-[#728078]"}`}><Icon size={19}/>{item.label}</button>})}</nav>}

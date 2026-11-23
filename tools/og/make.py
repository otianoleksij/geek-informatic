#!/usr/bin/env python3
"""Генерує og-картинки 1200x630: українські в assets/og/<slug>.png, англійські в assets/og/en/<slug>.png.
  python3 tools/og/make.py                  усі мови, усі слаги
  python3 tools/og/make.py robot mars       лише ці слаги
  python3 tools/og/make.py --lang en        лише англійські
Тексти для кожної мови лежать у PAGES нижче (слаг -> заголовок, підзаголовок, бейдж, кольори, іконка).
Потрібен Google Chrome (macOS). Тимчасові HTML пишуться в системну тимчасову теку."""
import subprocess, sys, os, tempfile
HERE=os.path.dirname(os.path.abspath(__file__))
R=os.path.abspath(os.path.join(HERE,"..",".."))+"/"
TMP=tempfile.mkdtemp()
CHROME=os.environ.get("CHROME","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
F="file://"+R+"assets/fonts/"
shield='<path d="M60 10l40 15v31c0 25-17 43-40 52-23-9-40-27-40-52V25z" fill="#FFE45C" stroke="#14213A" stroke-width="4" stroke-linejoin="round"/><rect x="44" y="52" width="32" height="26" rx="5" fill="#14213A"/><path d="M50 52v-7a10 10 0 0 1 20 0v7" stroke="#14213A" stroke-width="5" fill="none"/><circle cx="60" cy="63" r="4" fill="#FFE45C"/>'
planet='<circle cx="60" cy="60" r="30" fill="#FFE45C" stroke="#14213A" stroke-width="4"/><ellipse cx="60" cy="60" rx="52" ry="14" transform="rotate(-20 60 60)" fill="none" stroke="#5EE6FF" stroke-width="6"/><circle cx="48" cy="52" r="6" fill="#14213A" opacity=".25"/><circle cx="70" cy="70" r="4" fill="#14213A" opacity=".25"/>'
robot='<rect x="30" y="34" width="60" height="50" rx="12" fill="#FFE45C" stroke="#14213A" stroke-width="4"/><circle cx="48" cy="56" r="7" fill="#14213A"/><circle cx="72" cy="56" r="7" fill="#14213A"/><path d="M48 72h24" stroke="#14213A" stroke-width="4" stroke-linecap="round"/><path d="M60 34V20" stroke="#14213A" stroke-width="4"/><circle cx="60" cy="16" r="6" fill="#FFE45C" stroke="#14213A" stroke-width="3"/>'
mars='<circle cx="38" cy="82" r="16" fill="#FFE45C" stroke="#14213A" stroke-width="4"/><circle cx="82" cy="82" r="16" fill="#FFE45C" stroke="#14213A" stroke-width="4"/><rect x="26" y="46" width="68" height="26" rx="8" fill="#FFFFFF" stroke="#14213A" stroke-width="4"/><path d="M60 46V28l14-6" stroke="#14213A" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="48" cy="59" r="5" fill="#14213A"/>'
reb='<g transform="rotate(-8 40 66)"><rect x="10" y="38" width="62" height="62" rx="12" fill="#FFE45C" stroke="#14213A" stroke-width="4"/><circle cx="41" cy="62" r="12" fill="#fff" stroke="#14213A" stroke-width="3.5"/></g><g transform="rotate(9 84 52)"><rect x="58" y="14" width="56" height="56" rx="12" fill="#C6F0D8" stroke="#14213A" stroke-width="4"/><path d="M76 36a9 9 0 1 1 13 8c-3 2-4 4-4 7" stroke="#14213A" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="85" cy="59" r="3.2" fill="#14213A"/></g>'
sir='<rect x="14" y="14" width="92" height="92" rx="22" fill="#FFE45C" stroke="#14213A" stroke-width="4"/><g stroke="#14213A" stroke-width="3" stroke-linecap="round"><rect x="26" y="36" width="50" height="9" rx="4.5" fill="#E7C98A"/><rect x="26" y="36" width="12" height="9" rx="4.5" fill="#E2483D"/><rect x="26" y="75" width="50" height="9" rx="4.5" fill="#E7C98A"/><rect x="26" y="75" width="12" height="9" rx="4.5" fill="#E2483D"/><rect x="84" y="28" width="9" height="46" rx="4.5" fill="#E7C98A"/><rect x="84" y="28" width="9" height="12" rx="4.5" fill="#E2483D"/></g>'
logo='<path d="M12 10l-5 6 5 6M20 10l5 6-5 6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
code='<rect x="14" y="14" width="92" height="92" rx="24" fill="#FFE45C" stroke="#14213A" stroke-width="4"/><path d="M48 40L28 60l20 20M72 40l20 20-20 20" stroke="#14213A" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
# слаг: (колір 1, колір 2, іконка, {мова: (заголовок, підзаголовок, бейдж)})
PAGES={
 "home":("#2D55E0","#1B3AA8",code,{
   "uk":("Інформатика,<br>в&nbsp;яку грають","Вебквести, ігри й ребуси · 1–11 клас","1–11 клас"),
   "en":("Computer science<br>you can play","Quests, games, puzzles · grades 1–11","Grades 1–11")}),
 "agenty-kibershchytu":("#2D55E0","#1B3AA8",shield,{
   "uk":("Агенти КіберЩиту","6 клас · кібербезпека","6 клас"),
   "en":("Cyber Shield Agents","Grade 6 · cyber safety","Grade 6")}),
 "kod-galaktyky":("#251B5C","#150F38",planet,{
   "uk":("Код Галактики","7 клас · цикли й алгоритми","7 клас"),
   "en":("Galaxy Code","Grade 7 · loops and algorithms","Grade 7")}),
 "robot":("#12A38A","#0B6B6E",robot,{
   "uk":("Я керую роботом!","3–4 клас · алгоритми й цикли","3–4 клас"),
   "en":("Drive the Robot!","Grades 3–4 · algorithms and loops","Grades 3–4")}),
 "mars":("#C4572B","#7A2E17",mars,{
   "uk":("Марсохід у лабіринті","Алгоритм правої руки","Гра"),
   "en":("Mars Rover Maze","The right-hand rule","Game")}),
 "sirnyky":("#E0892B","#B0561B",sir,{
   "uk":("Задачі з сірниками","3–11 клас · логіка й кмітливість","3–11 клас"),
   "en":("Matchstick puzzles","Grades 3–11 · logic and ingenuity","Grades 3–11")}),
 "rebusy":("#E8505B","#B02A47",reb,{"uk":("100 ребусів з інформатики","1–11 клас · комп’ютерні слова","1–11 клас")}),
}
tpl=open(os.path.join(HERE,"tpl.html")).read()
args=sys.argv[1:]
langs=["uk","en"]
if "--lang" in args:
    i=args.index("--lang"); langs=[args[i+1]]; del args[i:i+2]
only=set(args)
for slug,(c1,c2,icon,texts) in PAGES.items():
    if only and slug not in only: continue
    for lang in langs:
        if lang not in texts: continue
        t,sub,grade=texts[lang]
        h=tpl.replace("{{F}}",F).replace("{{T}}",t).replace("{{S}}",sub).replace("{{C1}}",c1).replace("{{C2}}",c2).replace("{{G}}",grade).replace("{{ICON}}",icon).replace("{{LOGO}}",logo).replace("{{TS}}","font-size:60px" if slug=="home" else "")
        src=os.path.join(TMP,f"{slug}-{lang}.html"); open(src,"w").write(h)
        d=R+"assets/og/"+("" if lang=="uk" else lang+"/")
        os.makedirs(d,exist_ok=True)
        out=d+f"{slug}.png"
        subprocess.run([CHROME,"--headless=new","--disable-gpu","--hide-scrollbars","--force-device-scale-factor=1","--window-size=1200,630","--virtual-time-budget=3000",f"--screenshot={out}","file://"+src],capture_output=True)
        print(out, os.path.getsize(out)//1024, "KB")

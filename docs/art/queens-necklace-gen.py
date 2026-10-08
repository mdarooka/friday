# Queens Necklace artwork generator (About page hero).
#
# Regenerate from the repo root:
#   python3 docs/art/queens-necklace-gen.py          # day   -> assets/images/about-queens-necklace.svg
#   python3 docs/art/queens-necklace-gen.py night    # night -> assets/images/about-queens-necklace-night.svg
# Output always goes to assets/images, relative to this file, whatever the working directory.
# Only the day image is used on the site; the night image is saved for later.
import random, math, sys, os
NIGHT = (len(sys.argv)>1 and sys.argv[1]=="night")
random.seed(11 if not NIGHT else 11)
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..","assets","images")
OUT=os.path.join(D,"about-queens-necklace-night.svg" if NIGHT else "about-queens-necklace.svg")
def hx(c): return tuple(int(c[i:i+2],16) for i in (1,3,5))
def mix(a,b,t):
    t=max(0,min(1,t)); A_,B_=hx(a),hx(b); return "#%02x%02x%02x"%tuple(round(A_[i]+(B_[i]-A_[i])*t) for i in range(3))
PREC=0
def f(x):
    if abs(x)>=1000 or (PREC==0 and abs(x)>=10): return "%d"%round(x)
    return ("%.1f"%x).rstrip('0').rstrip('.')
if NIGHT:
    HAZE="#3A4666"; SH="#0B0F1A"; LTC="#9FB0D4"
    FPAL=["#2C3550","#34405C","#2A3148","#3B4560","#303A52","#41405A","#37425A"]
    RPAL=["#222A40","#2C3550","#3A405A","#262E44","#454860"]
    LAND="#1C2336"; SIL="#252E48"; WDARK="#0E1220"; WOP=.7
    LITC=["#F2C66B","#E8A54B","#F2C66B","#E8A54B","#DDE8F2"]
    LITP=(.45,.34,.26)
else:
    HAZE="#EBCFA8"; SH="#6E5A4A"; LTC="#F6EEDC"
    FPAL=["#EEE2C6","#E2C9A6","#DDAE8C","#EBD095","#CBD1BF","#F2EBDD","#E4B9A0"]
    RPAL=["#C98E6B","#E2C9A6","#AEAE81","#D9B99A","#B8AE92"]
    LAND=mix("#A39878",HAZE,.25); SIL=mix("#B9A07E",HAZE,.25); WDARK="#4a3a30"; WOP=.85
    LITC=["#F2C66B","#F6C96B","#E8A54B"]
    LITP=(.3,.24,.18)
HY=165; CC=470
G=[(-760,300),(-2300,1400),(-900,2600),(1900,2700)]
CEN=(-100,1500)
def bez(u):
    a=(1-u)**3;b=3*u*(1-u)**2;c=3*u*u*(1-u);d=u**3
    return (a*G[0][0]+b*G[1][0]+c*G[2][0]+d*G[3][0], a*G[0][1]+b*G[1][1]+c*G[2][1]+d*G[3][1])
def der(u):
    e=1e-4; p=bez(max(0,u-e)); q=bez(min(1.02,u+e)); dx,dw=q[0]-p[0],q[1]-p[1]; L=math.hypot(dx,dw); return dx/L,dw/L
def nrm(u):
    tx,tw=der(u); n=(-tw,tx); p=bez(u)
    if n[0]*(p[0]-CEN[0])+n[1]*(p[1]-CEN[1])<0: n=(tw,-tx)
    return n
def gp(u,off):
    p=bez(u); n=nrm(u); return (p[0]+n[0]*off,p[1]+n[1]*off)
def pj(g):
    s=500/g[1]; return (800+g[0]*s, HY+CC*s, s)
def spos(u,off): return pj(gp(u,off))
NS=900
def table(off):
    pts=[gp(i/NS,off) for i in range(NS+1)]; cum=[0]
    for i in range(1,NS+1): cum.append(cum[-1]+math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]))
    return cum
def u_at(cum,d):
    lo,hi=0,len(cum)-1
    while lo<hi:
        m=(lo+hi)//2
        if cum[m]<d: lo=m+1
        else: hi=m
    return lo/NS
o=[]; A=o.append
EXTRA=[]
if NIGHT:
    SKY=[(0,"#111729"),(.45,"#1C2540"),(.8,"#2A3550"),(1,"#4A4F6C")]
    SEA=[(0,"#3D4868"),(.1,"#2C3A58"),(.4,"#1A2D48"),(1,"#0C1D30")]
else:
    SKY=[(0,"#6F8A90"),(.4,"#B9B7A4"),(.75,"#E6C294"),(1,"#F0B77E")]
    SEA=[(0,"#EAB98A"),(.1,"#C2B49A"),(.35,"#7F9FA0"),(1,"#3F6667")]
def stops(l): return "".join(f'<stop offset="{a}" stop-color="{c}"/>' for a,c in l)
GL="#AFC4E6" if NIGHT else "#FFE9B0"
A('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 700" width="1600" height="700" preserveAspectRatio="xMidYMid slice">')
A(f'''<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">{stops(SKY)}</linearGradient>
<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">{stops(SEA)}</linearGradient>
<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="{GL}" stop-opacity="{'.6' if NIGHT else '.95'}"/><stop offset=".25" stop-color="{'#8FA6CF' if NIGHT else '#F6CE82'}" stop-opacity="{'.25' if NIGHT else '.55'}"/><stop offset="1" stop-color="{'#8FA6CF' if NIGHT else '#F3B77A'}" stop-opacity="0"/></radialGradient>
<radialGradient id="disk" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="{'#F4F6FA' if NIGHT else '#F8D78C'}"/><stop offset="1" stop-color="{'#CBD5E4' if NIGHT else '#E4B14A'}"/></radialGradient>
<radialGradient id="lg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE6A6" stop-opacity=".95"/><stop offset=".3" stop-color="#F6CD7A" stop-opacity="{'.4' if NIGHT else '.45'}"/><stop offset="1" stop-color="#F6CD7A" stop-opacity="0"/></radialGradient>
<radialGradient id="pg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="{'#DDE8F6' if NIGHT else '#F6D590'}" stop-opacity="{'.35' if NIGHT else '.5'}"/><stop offset=".6" stop-color="{'#DDE8F6' if NIGHT else '#F6D590'}" stop-opacity=".12"/><stop offset="1" stop-color="{'#DDE8F6' if NIGHT else '#F6D590'}" stop-opacity="0"/></radialGradient>
<linearGradient id="lit" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{'#05070E' if NIGHT else '#6E4F3E'}" stop-opacity="{'.3' if NIGHT else '.16'}"/><stop offset=".5" stop-color="#F6D590" stop-opacity="0"/><stop offset="1" stop-color="{'#9FB0D4' if NIGHT else '#F8D48A'}" stop-opacity="{'.14' if NIGHT else '.4'}"/></linearGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{HAZE}" stop-opacity="0"/><stop offset=".45" stop-color="{'#4A5476' if NIGHT else '#F3D2A0'}" stop-opacity="{'.22' if NIGHT else '.14'}"/><stop offset="1" stop-color="{HAZE}" stop-opacity="0"/></linearGradient>
<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#15140F" stop-opacity="0"/><stop offset="1" stop-color="#05070E" stop-opacity="{'.4' if NIGHT else '.3'}"/></radialGradient>
<filter id="blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="blur3" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="3.5"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .27  0 0 0 0 .18  0 0 0 1.6 -.55"/></filter>
<filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .04" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 .95  0 0 0 0 .93  0 0 0 0 .86  0 0 0 1.2 -.4"/></filter>
<!--EXTRA--></defs>''')
SX,SY=(1310,138) if NIGHT else (1160,282)
SX,SY=(1310,140) if NIGHT else (1315,146)
A('<rect x="-10" y="-10" width="1620" height="720" fill="url(#sky)"/>')
if NIGHT:
    for i in range(35):
        x=random.uniform(0,1600); y=random.uniform(0,150)**1; y=random.uniform(0,150)
        A(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(random.choice([.6,.7,.9,1.2]))}" fill="#E6ECF8" opacity="{random.uniform(.25,.85):.2f}"/>')
    cl=[(420,70,300,12,"#3A4666",.35),(900,100,330,9,"#4A5070",.3),(1250,55,240,10,"#3A4666",.3),(200,125,220,8,"#46506E",.3)]
else:
    cl=[(420,60,300,14,"#E9C9A0",.4),(900,95,330,11,"#F0B887",.5),(1250,45,240,12,"#F2CFA0",.45),(200,120,220,9,"#E8B890",.45),(1450,110,200,10,"#F0AE80",.5),(700,30,220,10,"#C9C5B0",.35)]
for (cx,cy,rx,ry,c,op) in cl:
    A(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{c}" opacity="{op}" filter="url(#blur)"/>')
A(f'<circle cx="{SX}" cy="{SY}" r="{200 if NIGHT else 250}" fill="url(#glow)"/><circle cx="{SX}" cy="{SY}" r="{25 if NIGHT else 28}" fill="url(#disk)"/>')
if NIGHT:
    EXTRA.append(f'<clipPath id="mc"><circle cx="{SX}" cy="{SY}" r="25"/></clipPath>')
    A(f'<ellipse cx="{SX+10}" cy="{SY-3}" rx="21" ry="26" fill="#1E2744" opacity=".5" clip-path="url(#mc)"/><circle cx="{SX-8}" cy="{SY+6}" r="3.5" fill="#9AA6BC" opacity=".25"/><circle cx="{SX-3}" cy="{SY-9}" r="2.5" fill="#9AA6BC" opacity=".2"/>')
A(f'<rect x="-10" y="{HY}" width="1620" height="{720-HY}" fill="url(#sea)"/>')
# glitter
A(f'<ellipse cx="{SX+25}" cy="450" rx="190" ry="330" fill="url(#pg)"/><ellipse cx="{SX}" cy="215" rx="70" ry="90" fill="url(#pg)"/>')
GC="#E4ECF8" if NIGHT else "#FCE3A6"
for i in range(50 if NIGHT else 70):
    d=random.random()**1.2; y=HY+3+d*(700-HY); k=(y-HY)/(700-HY); hw=18+k*210
    x=SX+k*20+random.gauss(0,hw*.38); rx=3+k*random.uniform(4,24); ry=.5+k*.7
    A(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx)}" ry="{f(ry)}" fill="{GC}" opacity="{random.uniform(.35,.85):.2f}"/>')
RC=["#7D9BC4","#050D18","#4F6D93"] if NIGHT else ["#BBD0C6","#2F5654","#9DB3AC"]
for i in range(22 if NIGHT else 40):
    y=HY+8+random.random()**.8*(700-HY); k=(y-HY)/(700-HY); x=random.uniform(-20,1620); l=10+k*random.uniform(30,110)
    A(f'<path d="M{round(x)} {round(y)}h{round(l)}" stroke="{random.choice(RC)}" stroke-width="{f(.8+k*1.6)}" stroke-linecap="round" opacity="{random.uniform(.1,.24):.2f}"/>')
# bridge
if NIGHT: bc="#8DA2C2"; DY=183; bop=.55
else: bc="#5F7371"; DY=183; bop=.72
A(f'<g opacity="{bop}" fill="none" stroke="{bc}" stroke-linecap="round">')
A(f'<path d="M1186 {DY+1.5}L1405 {DY-1}" stroke-width="2.4"/>')
for px in range(1190,1405,14): A(f'<path d="M{px} {DY+1}v4" stroke-width="1"/>')
A(f'<path d="M1244 {DY}L1245.5 134M1256 {DY}L1254.5 134M1245 150H1255M1245.8 141H1254.2" stroke-width="1.6"/>')
for i in range(1,10):
    dx=7+i*6.5; ty=137+i*1.1
    A(f'<path d="M1245 {ty:.1f}L{1250-dx:.1f} {DY}M1255 {ty:.1f}L{1250+dx:.1f} {DY}" stroke-width=".55"/>')
A('</g>')
if NIGHT:
    A('<path d="M'+"".join(f"{x} {DY-1.8:.1f}h1.2" if False else f"M{x} {DY-2:.1f}h1" for x in range(1188,1404,5))[1:]+'" stroke="#FFE2A0" stroke-width="1.6" fill="none"/>')
    A(f'<circle cx="1245" cy="133" r="1.4" fill="#FF5A4A"/><circle cx="1255" cy="133" r="1.4" fill="#FF5A4A"/><path d="M1190 {DY+4}h210" stroke="#F6CD7A" stroke-width="3" opacity=".18" filter="url(#blur3)"/>')
# lamps
LAMP=[]; cum0=table(-145); tot=cum0[-1]; d=10
while d<tot:
    u=u_at(cum0,d); LAMP.append(u); d+=36
if NIGHT:
    for u in LAMP:
        x,y,s=spos(u,-150)
        if s<.25 and random.random()<.6: continue
        dd=""
        for k in range(4):
            oo=-190-k*(55+25*s*0)-random.uniform(0,20)
            xx,yy,ss=spos(u,oo)
            xx+=random.uniform(-2,2)*ss*3
            w=(5+14*ss)*(1-k*.12)
            dd+=f"M{f(xx-w/2)} {f(yy)}h{f(w)}"
        A(f'<path d="{dd}" stroke="#F6CD7A" stroke-width="{f(.7+1.5*s)}" stroke-linecap="round" opacity="{.5 if s>.3 else .38}"/>')
else:
    for u in LAMP[1::3]:
        for k,(oo,op) in enumerate([(-235,.4),(-285,.28)]):
            x,y,s_=spos(u,oo)
            if s_>.75: continue
            A(f'<ellipse cx="{f(x+random.uniform(-2,2))}" cy="{f(y)}" rx="{f(1.5+5*s_)}" ry="{f(.5+.7*s_)}" fill="#F6CD7A" opacity="{op}"/>')
if not NIGHT: A('<ellipse cx="860" cy="470" rx="520" ry="150" fill="#E9B98A" opacity=".1" filter="url(#blur)"/>')
for i in range(25):
    x=random.uniform(250,1150); y=random.uniform(430,690); k=(y-165)/540; l=20+k*70
    A(f'<path d="M{round(x)} {round(y)}h{round(l)}" stroke="{random.choice(RC[:2])}" stroke-width="{f(.8+k*1.3)}" stroke-linecap="round" opacity=".2"/>')
# land
arc=[spos(i/150,0) for i in range(151)]
pg=[(x,y) for x,y,_ in arc]
tipx,tipy,_=arc[-1]
pg+= [(tipx+6,tipy-26),(tipx-30,HY+6),(-100,HY+6),(-100,820),(arc[0][0],820)]
A('<polygon points="'+" ".join(f"{f(x)},{f(y)}" for x,y in pg)+f'" fill="{LAND}"/>')
# far city rows
def xbound(y): return tipx-30+(y-HY-6)/((tipy-26)-(HY+6))*36
allrows=[]; FB={}; OB={}
def addr(B_,col,x,y,w,h): B_.setdefault(col,[]).append(f"M{round(x)} {round(y)}h{max(1,round(w))}v{round(h)}h-{max(1,round(w))}z")
def pick(prev,pal):
    c=random.choice([p for p in pal if p not in prev[-2:]]); prev.append(c); return c
fo=490; prevf=[]; bid=0; rowrng=[]
while fo<3600:
    o1=fo+random.uniform(80,120)+fo*.04
    cum=table(fo); tot=cum[-1]; d=random.uniform(0,40); ssum=0; sn=0
    while d<tot-30:
        L=random.uniform(100,230)+fo*.03; gap=random.uniform(5,10)+fo*.004
        u0=u_at(cum,d); u1=u_at(cum,min(tot,d+L-gap)); d+=L
        P=[gp(u0,fo),gp(u1,fo),gp(u1,o1),gp(u0,o1)]
        if min(p[1] for p in P)<330: continue
        S=[pj(p) for p in P]; sm=sum(q[2] for q in S)/4
        if sm>.3: continue
        ssum+=sm; sn+=1
        h=random.choice([90,120,150,190,240,130,160])
        if random.random()<.07: h=random.uniform(320,520)
        up=h*sm*.85
        x0=min(S[0][0],S[3][0]); x1=max(S[1][0],S[2][0]); yb=max(S[0][1],S[1][1]); yt=min(S[2][1],S[3][1])
        if (x0+x1)/2>xbound(yb)+4: continue
        mm=min(.55,(1-sm)*.55+.05)
        base=pick(prevf,FPAL); base=mix(base,random.choice(["#FFFFFF" if not NIGHT else "#8FA0C4",SH,base]),.13)
        fc=mix(base,HAZE,mm)
        addr(FB,fc,x0,yb-up,x1-x0,up)
        rc=mix(random.choice(RPAL),HAZE,mm*.8)
        addr(OB,rc,x0-.5,yt-up,x1-x0+1,max(1,yb-yt))
        sc_=mix(SH,HAZE,mm*.6)
        addr(OB,sc_,x1-max(1,(x1-x0)*.2),yb-up,max(1,(x1-x0)*.2),up)
        addr(OB,sc_,x0,yb-1,x1-x0,1.5)
        if random.random()<.18: addr(OB,mix(SH,HAZE,mm),x0+(x1-x0)*.4,yt-up-max(1.5,9*sm),max(1,(x1-x0)*.22),max(1.5,9*sm))
    allrows.append((FB,OB,ssum/max(1,sn))); rowrng.append((fo,o1)); FB={}; OB={}
    fo=o1+random.uniform(8,20)

# ---- Mumbai skyscrapers ----
TOW={}
def tower(bx,by,s,wW,hW,style,idx,tall=False):
    global PREC
    PREC=1
    w=wW*s; H=hW*s*.85; x0=bx-w/2; x1=bx+w/2; xm=x0+w*.6; yT=by-H
    m=min(.45,(1-s)*.55)*(.75 if NIGHT else 1)
    tp=["#C9D2CC","#D9CDB4","#BFC6C4","#E0D2B8","#CFC3AE","#B9C4C8"] if not NIGHT else ["#2B3552","#323D5C","#283049","#3A4563"]
    base=random.choice(tp)
    lc=mix(mix(base,"#FFE3A8" if not NIGHT else "#9FB0D4",.32 if not NIGHT else .2),HAZE,m)
    sc_=mix(mix(base,SH,.32),HAZE,m); ol=mix(mix(base,SH,.62),HAZE,m*.7)
    cap=mix(sc_,lc,.45); sw=.55
    out=[]
    th=26*s*.85*(1.0 if style!="res" else 1.1); tw_=th*1.05
    pid=f"tw{idx}"
    yTop=yT+(w*.45 if style=="round" else 0)
    EXTRA.append(f'<pattern id="{pid}d" x="{f(x0)}" y="{f(yTop)}" width="{tw_:.2f}" height="{th:.2f}" patternUnits="userSpaceOnUse"><rect x="{tw_*.27:.2f}" y="{th*.3:.2f}" width="{tw_*.46:.2f}" height="{th*.42:.2f}" fill="{WDARK}" opacity="{WOP}"/></pattern>')
    nd=6 if NIGHT else 3
    lw,lh=tw_*3.1,th*3.3
    dots="".join(f'<rect x="{(random.randrange(3)*tw_+tw_*.27):.2f}" y="{(random.randrange(3)*th+th*.3):.2f}" width="{tw_*.46:.2f}" height="{th*.42:.2f}" fill="{random.choice(LITC)}"/>' for _ in range(nd))
    EXTRA.append(f'<pattern id="{pid}l" x="{f(x0)}" y="{f(yTop)}" width="{lw:.2f}" height="{lh:.2f}" patternUnits="userSpaceOnUse">{dots}</pattern>')
    # shaft
    ys=yTop
    out.append(f'<rect x="{f(x0)}" y="{f(ys)}" width="{f(xm-x0)}" height="{f(by-ys+3)}" fill="{sc_}" stroke="{ol}" stroke-width="{sw}"/>')
    out.append(f'<rect x="{f(xm)}" y="{f(ys)}" width="{f(x1-xm)}" height="{f(by-ys+3)}" fill="{lc}" stroke="{ol}" stroke-width="{sw}"/>')
    out.append(f'<rect x="{f(x0)}" y="{f(ys)}" width="{f(w)}" height="{f(by-ys)}" fill="url(#{pid}d)"/><rect x="{f(x0)}" y="{f(ys)}" width="{f(w)}" height="{f(by-ys)}" fill="url(#{pid}l)"/>')
    if style=="res":
        EXTRA.append(f'<pattern id="{pid}b" x="{f(x0)}" y="{f(ys)}" width="{w:.1f}" height="{th:.2f}" patternUnits="userSpaceOnUse"><rect x="0" y="{th*.82:.2f}" width="{w:.1f}" height="{th*.14:.2f}" fill="{mix(LTC,HAZE,m)}" opacity="{.35 if NIGHT else .6}"/></pattern>')
        out.append(f'<rect x="{f(x0)}" y="{f(ys)}" width="{f(w)}" height="{f(by-ys)}" fill="url(#{pid}b)"/>')
    top_y=yT
    if style=="round":
        out.append(f'<path d="M{f(x0)} {f(ys)}A{f(w/2)} {f(w*.45)} 0 0 1 {f(x1)} {f(ys)}Z" fill="{cap}" stroke="{ol}" stroke-width="{sw}"/>')
        top_y=yT
    elif style=="spire":
        c=H*.13
        out.append(f'<polygon points="{f(x0+w*.08)},{f(ys)} {f(bx)},{f(ys-c)} {f(bx)},{f(ys)}" fill="{sc_}" stroke="{ol}" stroke-width="{sw}"/><polygon points="{f(bx)},{f(ys)} {f(bx)},{f(ys-c)} {f(x1-w*.08)},{f(ys)}" fill="{lc}" stroke="{ol}" stroke-width="{sw}"/><path d="M{f(bx)} {f(ys-c)}v{f(-H*.06)}" stroke="{ol}" stroke-width=".7"/>')
        top_y=ys-c-H*.06
    elif style=="step":
        yy=ys
        for k,fr in enumerate((.78,.55)):
            ww=w*fr; hh=H*.045
            xa=bx-ww/2; xb=xa+ww*.6
            out.append(f'<rect x="{f(xa)}" y="{f(yy-hh)}" width="{f(xb-xa)}" height="{f(hh)}" fill="{sc_}" stroke="{ol}" stroke-width="{sw}"/><rect x="{f(xb)}" y="{f(yy-hh)}" width="{f(xa+ww-xb)}" height="{f(hh)}" fill="{lc}" stroke="{ol}" stroke-width="{sw}"/>')
            yy-=hh
        out.append(f'<path d="M{f(bx)} {f(yy)}v{f(-H*.05)}" stroke="{ol}" stroke-width=".7"/>'); top_y=yy-H*.05
    else:
        out.append(f'<rect x="{f(x0+w*.1)}" y="{f(ys-H*.025)}" width="{f(w*.5)}" height="{f(H*.025)}" fill="{sc_}" stroke="{ol}" stroke-width="{sw}"/>'); top_y=ys-H*.025
    if NIGHT and tall:
        out.append(f'<circle cx="{f(bx)}" cy="{f(top_y)}" r="1.7" fill="#FF5A4A"/><circle cx="{f(bx)}" cy="{f(top_y)}" r="5" fill="#FF5A4A" opacity=".25"/>')
    PREC=0
    return top_y,"".join(out)
# slots: (target_x, style, width, height, off_range, tall, twin)
specs=[(255,"res",110,480,(520,800),0),(330,"step",80,720,(700,1100),0),(410,"res",100,560,(520,800),0),
       (470,"spire",64,930,(900,1300),1),(545,"round",70,860,(800,1200),1),(585,"round",70,830,(800,1200),0),
       (660,"step",84,760,(700,1100),0),(725,"res",100,500,(520,800),0),(790,"spire",62,900,(900,1300),1),
       (860,"step",80,690,(700,1100),0),(925,"res",96,540,(520,820),0),(990,"round",68,880,(800,1200),1),
       (1050,"res",100,460,(520,800),0),(150,"res",110,440,(520,800),0),(1100,"step",78,640,(700,1000),0)]
for idx,(tx,st,wW,hW,orng,tall) in enumerate(specs):
    off=random.uniform(*orng); best=None
    for k in range(700):
        u=.25+k*.001; x,y,sc2=spos(u,off)
        if best is None or abs(x-tx)<best[0]: best=(abs(x-tx),u,x,y,sc2)
    _,u,x,y,sc2=best
    if best[0]>14 or y<190: continue
    rr=None
    for ri_,(a_,b_) in enumerate(rowrng):
        if a_<=off<b_+14: rr=ri_
    if rr is None: continue
    ty,svg=tower(x,y+2,sc2,wW*1.15,hW*1.22,st,idx,bool(tall))
    TOW.setdefault(rr,[]).append((y,svg))
pcount=0
for ri,(fb,ob,sm) in reversed(list(enumerate(allrows))):
    tw=1.8+14*sm; th=tw*.9
    EXTRA.append(f'<pattern id="pd{ri}" width="{tw:.1f}" height="{th:.1f}" patternUnits="userSpaceOnUse"><rect x="{tw*.3:.1f}" y="{th*.28:.1f}" width="{tw*.4:.1f}" height="{th*.42:.1f}" fill="{WDARK}" opacity="{WOP}"/></pattern>')
    lw,lh=tw*2.1,th*2.3
    nl=3 if NIGHT else 2
    dots="".join(f'<rect x="{random.uniform(.1,.8)*lw:.1f}" y="{random.uniform(.1,.8)*lh:.1f}" width="{max(1,tw*.45):.1f}" height="{max(1,th*.45):.1f}" fill="{random.choice(LITC)}"/>' for _ in range(nl))
    EXTRA.append(f'<pattern id="pl{ri}" width="{lw:.1f}" height="{lh:.1f}" patternUnits="userSpaceOnUse">{dots}</pattern>')
    for col,ds in fb.items():
        bid+=1; EXTRA.append(f'<path id="b{bid}" d="{"".join(ds)}"/>')
        A(f'<use href="#b{bid}" fill="{col}"/><use href="#b{bid}" fill="url(#pd{ri})"/><use href="#b{bid}" fill="url(#pl{ri})"/>')
    for col,ds in ob.items(): A(f'<path d="{"".join(ds)}" fill="{col}"/>')
    for _,sv in sorted(TOW.get(ri,[]),key=lambda t:t[0]): A(sv)
# skyline silhouette
x=-20
while x<1180:
    w=random.uniform(8,26); h=random.uniform(3,20)*(1+.8*max(0,(x-900)/300))
    A(f'<rect x="{f(x)}" y="{f(HY+6-h)}" width="{f(w-2)}" height="{f(h+2)}" fill="{SIL}"/>'); x+=w
# boxes
boxes=[]
def addbox(u0,u1,o0,o1,h,kind,row,col,rcol):
    P=[gp(u0,o0),gp(u1,o0),gp(u1,o1),gp(u0,o1)]
    cw=sum(p[1] for p in P)/4
    if min(p[1] for p in P)<330: return
    boxes.append((cw,P,h,kind,row,col,rcol))
rows=[(0,85,"F"),(100,175,"B"),(190,265,"B"),(280,360,"B"),(375,470,"B")]
for ri,(o0,o1,k) in enumerate(rows):
    cum=table(o0); tot=cum[-1]; d=random.uniform(0,30); prev=[]
    while d<tot-40:
        L=random.uniform(70,115) if k=="F" else (random.uniform(55,120) if k=="B" else random.uniform(110,200))
        gap=random.uniform(8,15)
        u0=u_at(cum,d); u1=u_at(cum,min(tot,d+L-gap))
        h=random.choice([130,160,190,160,215,175]) if k=="F" else random.choice([90,120,150,190,230,130])*(1+ri*.04)
        base=pick(prev,FPAL); base=mix(base,random.choice(["#FFFFFF" if not NIGHT else "#8FA0C4",SH,base]),.14)
        addbox(u0,u1,o0,o1,h,k,ri,base,random.choice(RPAL)); d+=L
TW=["#8E9A98","#9FA7A0","#B3A58C","#7F8C8C"] if not NIGHT else ["#38425C","#2E3752","#3F4863","#343C58"]
for i in range(26):
    u=random.uniform(.94,1.012); off=random.uniform(-25,140)
    addbox(u-.006,u,off,off+random.uniform(45,70),random.uniform(300,520),"T",0,random.choice(TW),"#9AA39C" if not NIGHT else "#2A324A")
boxes.sort(key=lambda b:-b[0])
def lerpP(a,b,t): return (a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)
poly=lambda pts:" ".join(f"{f(x)},{f(y)}" for x,y in pts)
for cw,P,h,kind,row,base,rcol in boxes:
    PREC=1
    S=[pj(p) for p in P]; s=sum(q[2] for q in S)/4
    PREC=0 if s<.85 else 1
    A_,B_,C_,D_=[(q[0],q[1]) for q in S]
    m=min(.5,max(0,1-s)**1.1*(.8 if kind!="T" else .4)+ (row*.01))
    if NIGHT: m*=.8
    cm=lambda c,t=0: mix(mix(c,SH,t),HAZE,m)
    up=h*s*.85
    A2=(A_[0],A_[1]-up);B2=(B_[0],B_[1]-up);C2=(C_[0],C_[1]-up);D2=(D_[0],D_[1]-up)
    body=cm(base); light=cm(LTC); shade=cm(base,.45); outl=cm(base,.55)
    sw=f(max(.4,.9*min(s,1)))
    A(f'<polygon points="{poly([A_,B_,B2,A2])}" fill="{body}" stroke="{outl}" stroke-width="{sw}" stroke-linejoin="round"/>')
    if s>.4:
        T=(P[1][0]-P[0][0],P[1][1]-P[0][1]); Ln=math.hypot(*T); T=(T[0]/Ln,T[1]/Ln)
        if -(T[0]*P[1][0]+T[1]*P[1][1])>0: A(f'<polygon points="{poly([B_,C_,C2,B2])}" fill="{shade}" stroke="{outl}" stroke-width="{sw}"/>')
        elif (T[0]*P[0][0]+T[1]*P[0][1])>0: A(f'<polygon points="{poly([A_,D_,D2,A2])}" fill="{shade}" stroke="{outl}" stroke-width="{sw}"/>')
    if s>.55: A(f'<polygon points="{poly([A_,B_,B2,A2])}" fill="url(#lit)"/>')
    L=math.hypot(P[1][0]-P[0][0],P[1][1]-P[0][1])
    if s>=.55: nfl=max(2,int(h/29)); cols=max(2,int(L/20))
    elif s>=.35: nfl=max(2,int(h/30)); cols=max(2,int(L/24))
    else: nfl=max(2,int(h/38)); cols=max(2,int(L/26))
    if kind=="T": cols=max(2,min(cols,3)); nfl=max(4,int(h/22))
    lp=LITP[0] if s>.55 else (LITP[1] if s>.3 else LITP[2])
    if kind=="T": lp=LITP[1]
    dk=[];lt={};bal=[]
    wf=.5/cols; dash=[]
    for fl in range(nfl):
        fv0=(fl+.25)/nfl; fv1=fv0+.45/nfl
        if s<.55 and kind!="T":
            dash.append((fv0+fv1)/2)
        for c in range(cols):
            fu0=(c+.22)/cols; fu1=fu0+wf
            islit=random.random()<lp
            if s<.55 and kind!="T" and not islit: continue
            pa=lerpP(A_,B_,fu0);pb=lerpP(A_,B_,fu1)
            q=(pa[0],pa[1]-up*fv0,pb[0]-pa[0],pb[1]-pa[1],up*(fv1-fv0))
            if islit: lt.setdefault(random.choice(LITC),[]).append(q)
            else: dk.append(q)
        if s>=.55 and kind!="T":
            fv=(fl+1)/nfl
            bal.append((A_[0],A_[1]-up*fv+.8,B_[0]-A_[0],B_[1]-A_[1],1.6*max(s,.5)+.8))
    qs=lambda q:f"M{f(q[0])} {f(q[1])}l{f(q[2])} {f(q[3])}v{f(-q[4])}l{f(-q[2])} {f(-q[3])}z"
    wc=cm(WDARK)
    if dk and not (NIGHT and s<.75 and random.random()<.7): A(f'<path d="{"".join(qs(q) for q in dk)}" fill="{wc}" opacity="{WOP}"/>')
    if dash:
        px=max(.8,up/nfl*.45)
        A(f'<path d="{"".join(f"M{f(A_[0])} {f(A_[1]-up*fv)}L{f(B_[0])} {f(B_[1]-up*fv)}" for fv in dash)}" stroke="{wc}" stroke-width="{f(px)}" stroke-dasharray="{f(max(.8,(L/cols)*s*.5))} {f(max(.8,(L/cols)*s*.5))}" fill="none" opacity=".75"/>')
    for col,qq in lt.items():
        A(f'<path d="{"".join(qs(q) for q in qq)}" fill="{mix(col,HAZE,m*.4)}"/>')
    if bal and not NIGHT: A(f'<path d="{"".join(qs(q) for q in bal)}" fill="{light}" opacity="{.55 if NIGHT else 1}"/>')
    rc=cm(rcol)
    A(f'<polygon points="{poly([A2,B2,C2,D2])}" fill="{rc}" stroke="{cm(base,.5)}" stroke-width="{sw}" stroke-linejoin="round"/>')
    if s>.5: A(f'<polygon points="{poly([A2,B2,C2,D2])}" fill="none" stroke="{light}" stroke-width="{f(max(.5,1.8*s))}" stroke-linejoin="round" opacity="{.35 if NIGHT else 1}"/>')
    if kind in ("F","B") and s>.45:
        i1=[lerpP(lerpP(A2,B2,.14),lerpP(D2,C2,.14),.2),lerpP(lerpP(A2,B2,.86),lerpP(D2,C2,.86),.2),lerpP(lerpP(A2,B2,.86),lerpP(D2,C2,.86),.8),lerpP(lerpP(A2,B2,.14),lerpP(D2,C2,.14),.8)]
        A(f'<polygon points="{poly(i1)}" fill="{cm(base)}" opacity=".75"/>')
        if kind=="F" and random.random()<.7:
            c=lerpP(lerpP(A2,B2,random.uniform(.3,.7)),lerpP(D2,C2,.5),.5); r=max(1.5,5.5*s)
            A(f'<rect x="{f(c[0]-r)}" y="{f(c[1]-r*1.3)}" width="{f(r*2)}" height="{f(r*1.3)}" fill="{cm("#8A7660" if not NIGHT else "#2A3248")}"/><ellipse cx="{f(c[0])}" cy="{f(c[1]-r*1.3)}" rx="{f(r)}" ry="{f(r*.45)}" fill="{cm("#C9B79A" if not NIGHT else "#3A4460")}"/>')
        if NIGHT and random.random()<.5:
            c=lerpP(lerpP(A2,B2,random.uniform(.2,.8)),lerpP(D2,C2,.5),.5)
            A(f'<circle cx="{f(c[0])}" cy="{f(c[1])}" r="{f(max(.8,1.5*s))}" fill="#FFE2A0"/>')
    if kind=="T":
        c=lerpP(lerpP(A2,B2,.5),lerpP(D2,C2,.5),.5)
        if random.random()<.5: A(f'<path d="M{f(c[0])} {f(c[1])}l0 {f(-up*.16)}" stroke="{cm(SH)}" stroke-width=".8"/>')
        if NIGHT and h>480 and random.random()<.5: A(f'<circle cx="{f(c[0])}" cy="{f(c[1]-up*.16)}" r="1.6" fill="#FF5A4A"/><circle cx="{f(c[0])}" cy="{f(c[1]-up*.16)}" r="4" fill="#FF5A4A" opacity=".25"/>')
# haze + tip edge
globals()['PREC']=0
A(f'<rect x="-10" y="{HY-10}" width="1620" height="150" fill="url(#haze)"/>')
A(f'<path d="M{f(tipx+6)} {f(tipy-26)}L{f(tipx-30)} {HY+6}" stroke="{mix(SH,HAZE,.2)}" stroke-width="1.6" opacity=".55" fill="none"/>')
# road
N=240
def strip(o0,o1,fill,op=1):
    a=[spos(i/N,o0) for i in range(N+1)]; b=[spos(i/N,o1) for i in range(N+1)]
    A('<polygon points="'+" ".join(f"{f(x)},{f(y)}" for x,y,_ in a+b[::-1])+f'" fill="{fill}" opacity="{op}"/>')
if NIGHT: strip(0,-25,"#3A3A48"); strip(-25,-95,"#1E222E"); strip(-95,-150,"#4A4A58")
else: strip(0,-25,"#D8BC92"); strip(-25,-95,"#A39080"); strip(-95,-150,"#E2C9A6")
strip(-62,-64,"#E9D3AE" if not NIGHT else "#6A6A7A",.45)
strip(-150,-160,"#8A7660" if not NIGHT else "#14182A",.8)
cumT=table(-172); dd=5
while dd<cumT[-1]:
    u=u_at(cumT,dd); x,y,s=spos(u,-172+random.uniform(-6,6)); r=max(1.2,6*s)
    if s<.75 and not NIGHT: A(f'<path d="M{f(x-r)} {f(y+r*.4)}L{f(x)} {f(y-r*.6)}L{f(x+r)} {f(y+r*.4)}L{f(x)} {f(y+r*.7)}z" fill="{mix("#8C8474" if not NIGHT else "#2A3040",HAZE,(1-s)*.5)}"/>')
    dd+=max(18,80*(1 if s>.5 else .9))
def palm(u,off):
    global PREC
    x,y,s=spos(u,off); PREC=0 if s<.5 else 1; h=62*s; m=(1-s)*.6
    tx,ty=x+random.uniform(-3,3)*s,y-h
    tc=mix("#6A5846" if not NIGHT else "#1C2230",HAZE,m)
    A(f'<path d="M{f(x)} {f(y)}L{f(tx)} {f(ty)}" stroke="{tc}" stroke-width="{f(max(1,3.2*s))}" stroke-linecap="round"/>')
    Lf=44*s; fc=mix(random.choice(["#6E7058","#8F8F66","#5E6B4E"] if not NIGHT else ["#1F2D2C","#26352F","#1B2830"]),HAZE,m); fc2=mix("#AEAE81" if not NIGHT else "#3B5048",HAZE,m)
    A(f'<ellipse cx="{f(tx)}" cy="{f(ty+Lf*.2)}" rx="{f(Lf*.8)}" ry="{f(Lf*.35)}" fill="#05070E" opacity=".16"/>')
    d1="";d2=""
    for k in range(10):
        a=math.radians(k*36+random.uniform(-8,8)); ex=tx+math.cos(a)*Lf; ey=ty+math.sin(a)*Lf*.5+Lf*.25
        cx_=tx+math.cos(a)*Lf*.5; cy_=ty+math.sin(a)*Lf*.3-Lf*.28
        d1+=f"M{f(tx)} {f(ty)}Q{f(cx_)} {f(cy_)} {f(ex)} {f(ey)}"
        d2+=f"M{f(tx)} {f(ty-.5)}Q{f(cx_)} {f(cy_-1)} {f(ex*.96+tx*.04)} {f(ey-1)}"
    A(f'<path d="{d1}" stroke="{fc}" stroke-width="{f(max(1,2.6*s))}" fill="none" stroke-linecap="round"/>')
    if s>.35: A(f'<path d="{d2}" stroke="{fc2}" stroke-width="{f(max(.5,1*s))}" fill="none" stroke-linecap="round" opacity=".8"/>')
cumP=table(-118); dd=20
while dd<cumP[-1]-10:
    palm(u_at(cumP,dd),-118); dd+=random.uniform(115,150)
PREC=0
# necklace
A('<g filter="url(#blur3)">')
for a,b in [(0,.3),(.3,.62),(.62,.85),(.85,1.0)]:
    pts=[spos(a+(b-a)*i/40,-148) for i in range(41)]; s=pts[20][2]
    A('<path d="M'+" L".join(f"{f(x)} {f(y)}" for x,y,_ in pts)+f'" stroke="#F6C970" stroke-width="{f((3+7*s) if not NIGHT else (2+3.5*s))}" fill="none" opacity="{.2 if NIGHT else .4}" stroke-linecap="round"/>')
A('</g>')
K=1.0
for u in LAMP:
    x,y,s=spos(u,-148)
    A(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f((4.5+16*s)*K)}" fill="url(#lg)"/><circle cx="{f(x)}" cy="{f(y)}" r="{f((1.1+2.8*s)*(1.15 if NIGHT else 1))}" fill="#FFF3CC"/>')
# boats
BH="#0C1622" if NIGHT else None
def wake(x,y,s,fl):
    L=95*s; sx_=x-fl*60*s*.8
    for sg in (-1,1):
        A(f'<polygon points="{f(sx_)},{f(y+1.5*s*sg-.7)} {f(sx_)},{f(y+1.5*s*sg+.7)} {f(sx_-fl*L)},{f(y+sg*14*s)}" fill="#EAF2EA" opacity="{.3 if NIGHT else .3}"/>')
def boat(x,y,s,c,fl=1):
    w=60*s;h=11*s
    if NIGHT: c="#0A121C"
    cab="#3B4A63" if NIGHT else "#E9DCC0"
    A(f'<g transform="translate({f(x)} {f(y)}) scale({fl} 1)"><ellipse cx="0" cy="{f(5*s)}" rx="{f(w*.7)}" ry="{f(2.5*s)}" fill="#2E4B4A" opacity=".35"/>'
      f'<path d="M{f(-w)} {f(-h*.4)}Q{f(-w*.1)} {f(h*.6)} {f(w*.9)} {f(-h*.9)}L{f(w*.8)} {f(-h*.2)}Q{f(w*.2)} {f(h*.9)} {f(-w*.7)} {f(h*.5)}Z" fill="{c}"/>'
      f'<rect x="{f(-w*.3)}" y="{f(-h*2.1)}" width="{f(w*.35)}" height="{f(h*1.3)}" fill="{cab}"/><rect x="{f(-w*.33)}" y="{f(-h*2.3)}" width="{f(w*.41)}" height="{f(h*.3)}" fill="#15140F" opacity=".75"/>'
      f'<path d="M{f(w*.45)} {f(-h*.8)}L{f(w*.5)} {f(-h*4.2)}" stroke="#15140F" stroke-width="{f(max(.8,1.4*s))}"/>'
      +(f'<circle cx="{f(w*.5)}" cy="{f(-h*4.2)}" r="{f(max(1,2.2*s))}" fill="#FFE2A0"/><circle cx="{f(w*.5)}" cy="{f(-h*4.2)}" r="{f(6*s+3)}" fill="url(#lg)"/><circle cx="{f(-w*.1)}" cy="{f(-h*1.4)}" r="{f(max(.8,1.4*s))}" fill="#F2C66B"/>' if NIGHT else f'<path d="M{f(w*.5)} {f(-h*4.2)}l{f(w*.28)} {f(h*.7)}l{f(-w*.28)} {f(h*.4)}z" fill="#C98E6B"/>')+'</g>')
for (X,W,c,fl) in [(-120,610,"#3A2A24",1),(250,540,"#2A3A39",-1),(-250,820,"#2A3A39",1),(380,640,"#8A4A36",-1),(900,1250,"#1F2E2D",1),(650,1850,"#2A3A39",-1),(1700,1000,"#3A2A24",1)]:
    x,y,s=pj((X,W)); wake(x,y,s*1.15,fl); boat(x,y,s*1.15,c,fl)
if not NIGHT:
    for (bx,by,sz) in [(520,70,13),(560,92,9),(610,62,11),(930,40,8),(970,52,6),(1130,90,9),(1160,74,7)]:
        A(f'<path d="M{bx-sz} {by}Q{bx-sz/2} {by-sz*.7} {bx} {by}Q{bx+sz/2} {by-sz*.7} {bx+sz} {by}" stroke="#15140F" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".65"/>')
else:
    A('<rect x="-10" y="-10" width="1620" height="720" fill="#0A1020" opacity=".12"/>')
if not NIGHT: A('<rect x="-10" y="-10" width="1620" height="720" fill="#E8A86C" opacity=".07"/>')
A('<rect x="-10" y="-10" width="1620" height="720" fill="url(#vig)"/>')
A(f'<rect x="0" y="0" width="1600" height="700" filter="url(#paper)" opacity="{.1 if NIGHT else .22}"/><rect x="0" y="0" width="1600" height="700" filter="url(#grain)" opacity="{.16 if NIGHT else .28}"/></svg>')
open(OUT,"w").write("\n".join(o).replace("<!--EXTRA-->","".join(EXTRA)))

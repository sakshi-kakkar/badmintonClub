
import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '⚡' },
  { to: '/tournaments', label: 'Tournaments', icon: '🏆' },
  { to: '/players', label: 'Players', icon: '👤' },
  { to: '/teams', label: 'Teams', icon: '🛡' },
  { to: '/courts', label: 'Courts', icon: '🏸' },
];

export default function Nav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <nav style={{ background:'#0F172A', borderBottom:'1px solid rgba(255,255,255,.07)', position:'sticky', top:0, zIndex:40 }}>
      <div style={{ maxWidth:1320, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px' }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:22, color:'#fff' }}>
              🏸 <span style={{ color:'#22D3EE' }}>SMASH</span>COURT
            </div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.35)', letterSpacing:2 }}>
              TOURNAMENT MANAGER
            </div>
          </div>

          <button
            onClick={() => setOpen(!open)}
            style={{
              background:'transparent',
              border:'1px solid rgba(255,255,255,.2)',
              color:'#fff',
              fontSize:22,
              padding:'6px 12px',
              borderRadius:8,
              cursor:'pointer'
            }}
          >
            ☰
          </button>
        </div>

        <div style={{ display: open ? 'flex' : 'none', flexDirection:'column', paddingBottom:12 }}>
          {NAV_ITEMS.map(item => {
            const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                style={{
                  padding:'14px 18px',
                  textDecoration:'none',
                  color: active ? '#22D3EE' : 'rgba(255,255,255,.75)',
                  borderLeft: active ? '3px solid #22D3EE' : '3px solid transparent',
                  fontWeight: active ? 700 : 500
                }}
              >
                {item.icon} {item.label}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/**
 * 登录页的等距 3D 几何背景（V2-18）。
 *
 * **Stitch 稿的 1:1 还原**（design/v2-18-landing/stitch-login/code.html 的
 * GeometricBackgroundCanvas）：一层全屏点阵网格 + 四组浮动几何体，
 * 左下那块亮橙立方体是视觉焦点。全部是内联 SVG，没有位图、没有 WebGL。
 *
 * ⚠️ **这个文件被「无硬编码色值」门禁排除**（QC.md §1.2）。
 * 它是一张矢量插画，里面那些 #94a3b8 / #e2e8f0 是插画自身的明暗关系，
 * 不是设计令牌；而渐变 defs 定义在第一个 SVG 里被后面几块引用，
 * 拆成独立 .svg 文件就得把 defs 复制四份，更难维护。
 * **别往这里加界面元素** —— 界面颜色仍然一律走令牌。
 *
 * 浮动动画（floating-anim-*）在 globals.css，已带 prefers-reduced-motion 降级。
 */
export default function LoginBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none" >
    {/* Global Tech Grid Pattern (Isometric Dot Matrix & Micro Crosshairs) */}
    <svg className="absolute inset-0 w-full h-full opacity-[0.45]" xmlns="http://www.w3.org/2000/svg">
    <defs>
    <pattern height="60" id="iso-tech-grid" patternUnits="userSpaceOnUse" width="60">
    {/* Coordinate Intersection Point */}
    <circle cx="30" cy="30" fill="#9ca3af" opacity="0.35" r="1"></circle>
    {/* Fine crosshair at 0,0 */}
    <path d="M-4 0 L4 0 M0 -4 L0 4" opacity="0.45" stroke="#d1d5db" strokeWidth="0.75"></path>
    <path d="M56 60 L64 60 M60 56 L60 64" opacity="0.45" stroke="#d1d5db" strokeWidth="0.75"></path>
    </pattern>
    {/* Precision gradients for lattices */}
    <linearGradient id="poly-wire-orange" x1="0%" x2="100%" y1="0%" y2="100%">
    <stop offset="0%" stopColor="#fe5c00" stopOpacity="0.9"></stop>
    <stop offset="100%" stopColor="#ff8940" stopOpacity="0.25"></stop>
    </linearGradient>
    <linearGradient id="facet-orange-top" x1="0%" x2="100%" y1="0%" y2="100%">
    <stop offset="0%" stopColor="#ff6b18" stopOpacity="0.85"></stop>
    <stop offset="100%" stopColor="#fe5c00" stopOpacity="0.95"></stop>
    </linearGradient>
    <linearGradient id="facet-orange-side" x1="0%" x2="0%" y1="0%" y2="100%">
    <stop offset="0%" stopColor="#e24a00" stopOpacity="0.9"></stop>
    <stop offset="100%" stopColor="#be3a00" stopOpacity="0.95"></stop>
    </linearGradient>
    <linearGradient id="facet-neutral-top" x1="0%" x2="100%" y1="0%" y2="100%">
    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95"></stop>
    <stop offset="100%" stopColor="#f3f4f6" stopOpacity="0.8"></stop>
    </linearGradient>
    <linearGradient id="facet-glass-glow" x1="0%" x2="100%" y1="0%" y2="100%">
    <stop offset="0%" stopColor="#fe5c00" stopOpacity="0.12"></stop>
    <stop offset="50%" stopColor="#ffffff" stopOpacity="0.04"></stop>
    <stop offset="100%" stopColor="#fe5c00" stopOpacity="0.02"></stop>
    </linearGradient>
    </defs>
    <rect fill="url(#iso-tech-grid)" height="100%" width="100%"></rect>
    </svg>
    {/* Top-Left Complex: Precision Multi-layer Stepped Data Platform & Topological Lattice */}
    <div className="absolute -top-10 left-8 w-[380px] h-[380px] floating-anim-slow">
    <svg className="w-full h-full" fill="none" viewBox="0 0 380 380" xmlns="http://www.w3.org/2000/svg">
    {/* Precision Axis Lines & Coordinate Guides */}
    <g opacity="0.4" stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="0.5">
    <line x1="40" x2="340" y1="210" y2="40"></line>
    <line x1="190" x2="190" y1="20" y2="350"></line>
    <line x1="40" x2="340" y1="70" y2="240"></line>
    </g>
    {/* Crosshair Markers & Angle Annotations */}
    <g fill="#94a3b8" fontFamily="JetBrains Mono, monospace" fontSize="8" opacity="0.6">
    <text x="50" y="80">+ AXIS_L1 // 30°</text>
    <text x="260" y="60">SEC_01 // 0.84</text>
    {/* Mini Crosshairs */}
    <path d="M48 95 h8 M52 91 v8" stroke="#64748b" strokeWidth="0.75"></path>
    <path d="M300 120 h8 M304 116 v8" stroke="#64748b" strokeWidth="0.75"></path>
    </g>
    {/* Stepped Hexagonal Foundation Layer 1 (Lower Plane) */}
    <polygon fill="#f8fafc" points="190,120 280,172 280,188 190,240 100,188 100,172" stroke="#e2e8f0" strokeWidth="0.75"></polygon>
    <polygon fill="#e2e8f0" points="100,188 190,240 190,250 100,198" stroke="#cbd5e1" strokeWidth="0.5"></polygon>
    <polygon fill="#cbd5e1" points="280,188 190,240 190,250 280,198" stroke="#94a3b8" strokeWidth="0.5"></polygon>
    {/* Stepped Layer 2 (Raised Isometric Slab with Hairline Grid Internal) */}
    <polygon fill="url(#facet-neutral-top)" points="190,80 260,120 190,160 120,120" stroke="#cbd5e1" strokeWidth="0.75"></polygon>
    <polygon fill="#f1f5f9" points="120,120 190,160 190,175 120,135" stroke="#cbd5e1" strokeWidth="0.75"></polygon>
    <polygon fill="#e2e8f0" points="260,120 190,160 190,175 260,135" stroke="#cbd5e1" strokeWidth="0.75"></polygon>
    {/* Top Face Micro Coordinate Lines & Contours */}
    <path d="M140,110 L210,150 M165,95 L235,135 M155,140 L225,100 M175,151 L245,111" stroke="#e2e8f0" strokeLinecap="round" strokeWidth="0.75"></path>
    {/* Precision Wireframe Prism Cage (Suspended Matrix) */}
    <g opacity="0.65" stroke="#94a3b8" strokeWidth="0.65">
    <polygon fill="none" points="190,45 235,71 190,97 145,71" stroke="#64748b" strokeDasharray="2 2"></polygon>
    <line x1="145" x2="145" y1="71" y2="105"></line>
    <line x1="235" x2="235" y1="71" y2="105"></line>
    <line x1="190" x2="190" y1="97" y2="130"></line>
    <line strokeDasharray="1 2" x1="190" x2="190" y1="45" y2="78"></line>
    </g>
    {/* Small Apex Glass Prism Node */}
    <polygon fill="#ffffff" fillOpacity="0.7" points="190,55 215,69 190,83 165,69" stroke="#000000" strokeOpacity="0.15" strokeWidth="0.75"></polygon>
    {/* Tech tick marks on edge */}
    <g stroke="#94a3b8" strokeWidth="0.75">
    <line x1="120" x2="116" y1="123" y2="125"></line>
    <line x1="130" x2="126" y1="129" y2="131"></line>
    <line x1="140" x2="136" y1="135" y2="137"></line>
    <line x1="150" x2="146" y1="141" y2="143"></line>
    </g>
    </svg>
    </div>
    {/* Bottom-Left Focal Anchor: High-Precision Engineered Isometric Data Polyhedron with Brand Orange Accent Facets */}
    <div className="absolute bottom-6 left-12 w-[340px] h-[340px] floating-anim-alt">
    <svg className="w-full h-full" fill="none" viewBox="0 0 340 340" xmlns="http://www.w3.org/2000/svg">
    {/* Radiating Construction & Projection Lines */}
    <g opacity="0.18" stroke="#fe5c00" strokeWidth="0.6">
    <line strokeDasharray="4 4" x1="20" x2="310" y1="170" y2="170"></line>
    <line strokeDasharray="4 4" x1="170" x2="170" y1="20" y2="310"></line>
    <line x1="60" x2="280" y1="240" y2="100"></line>
    <line x1="60" x2="280" y1="100" y2="240"></line>
    </g>
    {/* Technical Outer Caliper Ring */}
    <circle cx="170" cy="170" opacity="0.6" r="120" stroke="#cbd5e1" strokeDasharray="2 6" strokeWidth="0.5"></circle>
    <circle cx="170" cy="170" opacity="0.3" r="135" stroke="#fe5c00" strokeDasharray="1 8" strokeWidth="0.5"></circle>
    {/* Dimension Scale Labels */}
    <g fill="#64748b" fontFamily="JetBrains Mono, monospace" fontSize="8" opacity="0.7">
    <text x="35" y="165">RAD: 120.00</text>
    <text x="180" y="305">TANGENT_03 [OK]</text>
    <text fill="#fe5c00" opacity="0.8" x="240" y="125">0xFE5C00 // M1</text>
    </g>
    {/* Main Engineered 3D Monolith: Cut-Facet Polyhedron */}
    {/* Back Shadow Plane for Floating Depth */}
    <polygon fill="#000000" fillOpacity="0.02" points="170,250 250,205 170,160 90,205" style={{ filter: 'blur(10px)' }}></polygon>
    {/* Lower Geometric Bevels (Engineered Gray/White Crystal structure) */}
    <polygon fill="#e2e8f0" points="90,195 170,240 170,265 90,220" stroke="#cbd5e1" strokeWidth="0.75"></polygon>
    <polygon fill="#cbd5e1" points="170,240 250,195 250,220 170,265" stroke="#94a3b8" strokeWidth="0.75"></polygon>
    <polygon fill="#f8fafc" points="90,195 170,240 250,195 170,150" stroke="#e2e8f0" strokeWidth="0.75"></polygon>
    {/* Hero Focal: Vibrant Brand Orange Precision Cut Isometric Cube */}
    {/* Ambient Glow Behind Node */}
    <ellipse cx="170" cy="140" fill="url(#facet-glass-glow)" rx="60" ry="35"></ellipse>
    {/* Top Facet (Laser Crisp Bright Orange with Grid Lines) */}
    <polygon fill="url(#facet-orange-top)" points="170,65 235,102 170,140 105,102" stroke="#ffffff" strokeWidth="1"></polygon>
    {/* Hairline Laser Contours on Top Face */}
    <path d="M125,90 L190,127 M145,78 L210,115 M135,120 L198,84" stroke="#ffffff" strokeDasharray="2 2" strokeOpacity="0.45" strokeWidth="0.6"></path>
    {/* Left Facet (Direct Light Orange) */}
    <polygon fill="url(#poly-wire-orange)" points="105,102 170,140 170,215 105,177" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.75"></polygon>
    <polygon fill="#fe5c00" fillOpacity="0.95" points="105,102 170,140 170,215 105,177"></polygon>
    {/* Sub-division internal grating line */}
    <line stroke="#ffffff" strokeDasharray="1 2" strokeOpacity="0.4" strokeWidth="0.5" x1="137" x2="137" y1="121" y2="196"></line>
    <line stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.5" x1="105" x2="170" y1="139" y2="177"></line>
    {/* Right Facet (Deep Chiseled Shadow Orange) */}
    <polygon fill="url(#facet-orange-side)" points="235,102 170,140 170,215 235,177" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="0.75"></polygon>
    {/* Sub-division internal grating line */}
    <line stroke="#ffffff" strokeDasharray="1 2" strokeOpacity="0.3" strokeWidth="0.5" x1="202" x2="202" y1="121" y2="196"></line>
    <line stroke="#ffffff" strokeOpacity="0.25" strokeWidth="0.5" x1="170" x2="235" y1="177" y2="139"></line>
    {/* Sharp Corner Nodes (Vector Engineering Dots) */}
    <circle cx="170" cy="65" fill="#ffffff" r="2" stroke="#fe5c00" strokeWidth="1"></circle>
    <circle cx="235" cy="102" fill="#ffffff" r="1.75" stroke="#fe5c00" strokeWidth="0.75"></circle>
    <circle cx="105" cy="102" fill="#ffffff" r="1.75" stroke="#fe5c00" strokeWidth="0.75"></circle>
    <circle cx="170" cy="140" fill="#ffffff" r="2.25" stroke="#fe5c00" strokeWidth="1.25"></circle>
    <circle cx="170" cy="215" fill="#ffffff" r="1.75" stroke="#fe5c00" strokeWidth="0.75"></circle>
    </svg>
    </div>
    {/* Top-Right Complex: Suspended Cylindrical Data Vector & Wireframe Projection Beam */}
    <div className="absolute top-10 right-16 w-[340px] h-[340px] floating-anim-alt">
    <svg className="w-full h-full" fill="none" viewBox="0 0 340 340" xmlns="http://www.w3.org/2000/svg">
    {/* Orthographic Guideline Track to Center/Right */}
    <g opacity="0.5" stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="0.5">
    <line x1="20" x2="280" y1="260" y2="60"></line>
    <line x1="70" x2="290" y1="70" y2="200"></line>
    </g>
    {/* Digital Metrology Details */}
    <g fill="#94a3b8" fontFamily="JetBrains Mono, monospace" fontSize="7.5" opacity="0.75">
    <text x="140" y="80">P-INDEX: 094.22 // LAT</text>
    <text x="210" y="240">SEC: DELTA-T</text>
    <path d="M128 78 h6 M131 75 v6" stroke="#94a3b8" strokeWidth="0.75"></path>
    </g>
    {/* Precision Cylindrical Data Column (Semi-Transparent Glass/Wireframe) */}
    {/* Base ellipse */}
    <ellipse cx="130" cy="180" fill="#f1f5f9" rx="38" ry="16" stroke="#cbd5e1" strokeWidth="0.75"></ellipse>
    {/* Cylinder side walls */}
    <path d="M92 110 L92 180 A38 16 0 0 0 168 180 L168 110 Z" fill="url(#facet-neutral-top)" fillOpacity="0.8" stroke="#cbd5e1" strokeWidth="0.75"></path>
    {/* Internal Contour/Raster Lines inside cylinder */}
    <ellipse cx="130" cy="155" fill="none" rx="38" ry="16" stroke="#e2e8f0" strokeDasharray="2 3" strokeWidth="0.75"></ellipse>
    <ellipse cx="130" cy="132" fill="none" rx="38" ry="16" stroke="#e2e8f0" strokeWidth="0.75"></ellipse>
    {/* Cylinder top rim */}
    <ellipse cx="130" cy="110" fill="#ffffff" rx="38" ry="16" stroke="#94a3b8" strokeWidth="0.85"></ellipse>
    {/* Cylinder top target center */}
    <circle cx="130" cy="110" fill="#fe5c00" r="1.5"></circle>
    <circle cx="130" cy="110" r="6" stroke="#cbd5e1" strokeDasharray="1 2" strokeWidth="0.5"></circle>
    {/* Linear Trajectory Line Connecting to Crisp Accent Mini-Cube */}
    <line opacity="0.6" stroke="#fe5c00" strokeDasharray="2 2" strokeWidth="0.75" x1="155" x2="225" y1="110" y2="135"></line>
    <circle cx="190" cy="122" fill="#fe5c00" r="1"></circle>
    {/* Precision Floating Micro Polyhedron (Secondary Sharp Orange Accent) */}
    <g transform="translate(210, 110)">
    <polygon fill="url(#facet-orange-top)" points="35,15 62,30 35,46 8,30" stroke="#ffffff" strokeWidth="0.75"></polygon>
    <polygon fill="#fe5c00" points="8,30 35,46 35,76 8,60" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.5"></polygon>
    <polygon fill="#cc4600" points="62,30 35,46 35,76 62,60" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.5"></polygon>
    {/* Wireframe projection shadow under cube */}
    <polygon fill="none" opacity="0.4" points="35,82 55,93 35,104 15,93" stroke="#fe5c00" strokeDasharray="1 2" strokeWidth="0.5"></polygon>
    <line opacity="0.5" stroke="#fe5c00" strokeDasharray="1 1" strokeWidth="0.5" x1="35" x2="35" y1="76" y2="82"></line>
    </g>
    </svg>
    </div>
    {/* Bottom-Right Complex: High-End Architectural Wireframe Grid & Stepped Topology Platform */}
    <div className="absolute -bottom-8 right-12 w-[380px] h-[380px] floating-anim-subtle">
    <svg className="w-full h-full" fill="none" viewBox="0 0 380 380" xmlns="http://www.w3.org/2000/svg">
    {/* Ground Projection Grid (Isometric Isometric Plane Matrix) */}
    <g opacity="0.5" stroke="#cbd5e1" strokeWidth="0.5">
    <line x1="90" x2="270" y1="180" y2="284"></line>
    <line x1="120" x2="300" y1="163" y2="267"></line>
    <line x1="150" x2="330" y1="146" y2="250"></line>
    <line x1="270" x2="90" y1="146" y2="250"></line>
    <line x1="300" x2="120" y1="163" y2="267"></line>
    <line x1="330" x2="150" y1="180" y2="284"></line>
    </g>
    {/* Engineering Markers & Status Metrics */}
    <g fill="#94a3b8" fontFamily="JetBrains Mono, monospace" fontSize="8" opacity="0.75">
    <text x="180" y="325">GRID_COORD: 114.88 // 0x4B</text>
    <text x="275" y="150">+ NODAL_04</text>
    <path d="M265 148 h8 M269 144 v8" stroke="#94a3b8" strokeWidth="0.75"></path>
    </g>
    {/* Outer Stepped Polygonal Platform (Sleek Modern White/Gray) */}
    <polygon fill="#ffffff" points="210,130 310,188 210,246 110,188" stroke="#e2e8f0" strokeWidth="0.85"></polygon>
    <polygon fill="#f1f5f9" points="110,188 210,246 210,260 110,202" stroke="#cbd5e1" strokeWidth="0.75"></polygon>
    <polygon fill="#e2e8f0" points="310,188 210,246 210,260 310,202" stroke="#cbd5e1" strokeWidth="0.75"></polygon>
    {/* Inner Elevated Monolith (Crisp White Chamfer with Precision Wireframe Top) */}
    <polygon fill="url(#facet-neutral-top)" points="210,95 265,127 210,158 155,127" stroke="#cbd5e1" strokeWidth="0.85"></polygon>
    <polygon fill="#f8fafc" points="155,127 210,158 210,205 155,174" stroke="#cbd5e1" strokeWidth="0.75"></polygon>
    <polygon fill="#ebeef3" points="265,127 210,158 210,205 265,174" stroke="#cbd5e1" strokeWidth="0.75"></polygon>
    {/* Internal Laser Grids on Top Face */}
    <path d="M175,116 L230,147 M192,106 L247,137 M182,142 L238,110 M200,152 L256,120" stroke="#94a3b8" strokeOpacity="0.5" strokeWidth="0.5"></path>
    {/* Vertical Dimension Laser Axis Line */}
    <line opacity="0.7" stroke="#fe5c00" strokeDasharray="2 3" strokeWidth="0.75" x1="210" x2="210" y1="40" y2="95"></line>
    <circle cx="210" cy="40" fill="#fe5c00" r="1.5"></circle>
    <circle cx="210" cy="95" fill="#fe5c00" r="1.5"></circle>
    {/* Tech Graduation Tick Marks along Lower Rim */}
    <g opacity="0.6" stroke="#64748b" strokeWidth="0.75">
    <line x1="160" x2="160" y1="220" y2="225"></line>
    <line x1="175" x2="175" y1="228" y2="233"></line>
    <line x1="190" x2="190" y1="237" y2="242"></line>
    </g>
    </svg>
    </div>
    </div>
  )
}

// ==========================================
// 1. CONEXIÓN AL SERVIDOR SUPABASE (NUBE)
// ==========================================
const supabaseUrl = 'https://zfhhlqyxekrkczawzgsd.supabase.co';
const supabaseKey = 'sb_publishable_8mz5NZDUm7u_W95s3JKzoQ_EAVEKpVg'; 

const clienteSupabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true }
});

let inventarioNube = [];
let rutaActual = 'inicio';
let filtroActual = 'todos';
let busquedaActual = ''; 
let cocheActual = ''; 
let marcaActual = '';
let criterioOrden = 'nuevo';

let sessionActiva = false;
let usuarioId = null;
let favoritosNube = []; 
let carrito = JSON.parse(localStorage.getItem('mi_carrito')) || []; 

let paginaActual = 1;
const PIEZAS_POR_PAGINA = 12;

let cargandoInventario = true; 
let descargandoPiezas = false;

// ==========================================
// 2. DESCARGA SEGURA (SISTEMA ANTI-AHOGO)
// ==========================================
async function cargarPiezasDesdeLaNube() {
    if (descargandoPiezas) return; 
    
    descargandoPiezas = true; 
    cargandoInventario = true;
    renderizarVista(); 
    
    try {
        const { data, error } = await clienteSupabase.from('productos').select('*');
        
        if (error) { 
            console.error("❌ ERROR de Supabase:", error); 
            cargandoInventario = false;
            const contenedor = document.getElementById('almacen-piezas');
            if (contenedor) contenedor.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; background:#fff5f5; border-radius:10px; border:1px solid #ffcccc;"><h3 style="color:#e74c3c;">🚨 Error de conexión</h3><p>${error.message}</p></div>`;
            return; 
        }
        
        inventarioNube = data || [];
        cargandoInventario = false; 
        
        generarFiltrosDeMarca(); 
        generarSubFiltros();
        
        const parametrosUrl = new URLSearchParams(window.location.search);
        const ref = parametrosUrl.get('ref');
        if (ref) {
            const p = inventarioNube.find(item => item.referencia === ref);
            if (p) window.abrirModal(p.referencia);
        }
        
        if (parametrosUrl.get('vista') === 'favoritos') {
            setTimeout(() => verFavoritos(), 300);
        } else {
            renderizarVista();
        }
    } catch (err) {  
        console.error("💣 FALLO CRÍTICO:", err);
        cargandoInventario = false;
    } finally {
        descargandoPiezas = false; 
    }
}

// ==========================================
// 3. GENERADORES DE FILTROS LATERALES
// ==========================================
function generarFiltrosDeMarca() {
    const contenedor = document.getElementById('contenedor-marcas-dinamicas');
    if (!contenedor) return;
    let marcas = [...new Set(inventarioNube.map(p => p.marca || 'Otras'))].filter(m => m);
    
    // ⚡ AQUÍ CREAMOS EL BUSCADOR CON DESPLEGABLE (Datalist)
    let html = `
        <div style="position:relative; width:100%; margin-bottom: 10px;">
            <input list="lista-marcas-filtro" id="input-buscar-marca" placeholder="🔍 Escribe o elige una marca..." onchange="filtrarMarca(null, this.value)" style="width:100%; padding:12px 15px; border-radius:8px; border:2px solid #eee; font-size:1em; outline:none; box-shadow:inset 0 2px 5px rgba(0,0,0,0.02); transition: 0.3s;" onfocus="this.style.borderColor='#e74c3c'" onblur="this.style.borderColor='#eee'">
            <datalist id="lista-marcas-filtro">
                <option value="todas">Mostrar todas las marcas</option>
                ${marcas.map(m => `<option value="${m}">${m}</option>`).join('')}
            </datalist>
        </div>
    `;
    contenedor.innerHTML = html;
}

window.filtrarMarca = (btn, marca) => {
    // Si la marca no existe o es "todas", borramos el filtro
    marcaActual = (marca === 'todas' || !marca) ? '' : marca;
    
    // Si hay botones antiguos los limpiamos (por si acaso)
    document.querySelectorAll('.btn-marca-filtro').forEach(b => { b.style.background = '#f0f0f0'; b.style.color = '#333'; });
    if(btn) { btn.style.background = '#2c3e50'; btn.style.color = 'white'; }
    
    // Sincronizamos el buscador con la etiqueta que se haya pulsado
    const inputBuscador = document.getElementById('input-buscar-marca');
    if (inputBuscador && !btn) {
        inputBuscador.value = marca === 'todas' ? '' : marca;
    }
    
    paginaActual = 1; 
    renderizarVista();
}

function generarSubFiltros() {
    const bloque = document.getElementById('bloque-subfiltros');
    const contenedor = document.getElementById('contenedor-subfiltros-dinamicos');
    if (!bloque || !contenedor) return;
    if (rutaActual === 'inicio' || rutaActual === 'favoritos') { bloque.style.display = 'none'; return; }
    bloque.style.display = 'block';
    let tipos = [...new Set(inventarioNube.filter(p => p.seccion === rutaActual).map(p => p.filtro || 'Varios'))].filter(f => f);
    let html = `<button class="btn-subfiltro activo" onclick="filtrarSub(this, 'todos')" style="padding:6px 12px; background:#e74c3c; color:white; border:none; border-radius:4px; cursor:pointer; font-size:0.85em;">Todos</button>`;
    tipos.forEach(t => html += `<button class="btn-subfiltro" onclick="filtrarSub(this, '${t}')" style="padding:6px 12px; background:#f0f0f0; color:#333; border:1px solid #ccc; border-radius:4px; cursor:pointer; font-size:0.85em;">${String(t).charAt(0).toUpperCase() + String(t).slice(1)}</button>`);
    contenedor.innerHTML = html;
}

window.filtrarSub = (btn, sub) => {
    filtroActual = sub;
    document.querySelectorAll('.btn-subfiltro').forEach(b => { b.style.background = '#f0f0f0'; b.style.color = '#333'; });
    if(btn) { btn.style.background = '#e74c3c'; btn.style.color = 'white'; }
    paginaActual = 1; 
    renderizarVista();
}

function actualizarEtiquetasFiltros() {
    const contenedor = document.getElementById('etiquetas-filtros-activos');
    if (!contenedor) return;
    let html = '';
    
    if (rutaActual !== 'inicio' && rutaActual !== 'favoritos') html += `<div class="chip-filtro" onclick="quitarFiltro('ruta')" title="Quitar este filtro">Categoría: ${rutaActual.toUpperCase()} ✖</div>`;
    if (filtroActual !== 'todos') html += `<div class="chip-filtro" onclick="quitarFiltro('sub')" title="Quitar este filtro">Tipo: ${filtroActual.toUpperCase()} ✖</div>`;
    
    if (marcaActual !== '') html += `<div class="chip-filtro" onclick="quitarFiltro('marca')" style="background:#3498db; color:white; border-color:#3498db;" title="Quitar filtro de marca">Marca: ${marcaActual.toUpperCase()} ✖</div>`;
    
    if (cocheActual !== '') html += `<div class="chip-filtro" onclick="quitarFiltro('coche')" style="background:#2c3e50; color:white; font-weight:bold; border-color:#2c3e50; padding: 6px 12px; border-radius: 15px; cursor: pointer; display: inline-block;" title="Quitar filtro de vehículo">🚗 Coche: ${cocheActual.toUpperCase()} ✖</div>`;
    
    contenedor.innerHTML = html;
}

window.quitarFiltro = (tipo) => {
    paginaActual = 1; 
    if (tipo === 'ruta') {
        rutaActual = 'inicio'; filtroActual = 'todos';
        document.querySelectorAll('.btn-ruta-v').forEach(b => { b.style.background = 'white'; b.style.color = 'black'; b.style.borderColor = '#ddd'; });
        const btnInicio = document.querySelector('.btn-ruta-v[data-ruta="inicio"]');
        if(btnInicio) { btnInicio.style.background = '#e74c3c'; btnInicio.style.color = 'white'; btnInicio.style.borderColor = '#e74c3c'; }
        if(document.getElementById('titulo-ruta')) document.getElementById('titulo-ruta').innerText = 'Catálogo General';
        generarSubFiltros();
    }
    if (tipo === 'sub') {
        filtroActual = 'todos';
        document.querySelectorAll('.btn-subfiltro').forEach(b => { b.style.background = '#f0f0f0'; b.style.color = '#333'; });
        const btnTodos = document.querySelector('.btn-subfiltro[onclick*="todos"]');
        if(btnTodos) { btnTodos.style.background = '#e74c3c'; btnTodos.style.color = 'white'; }
    }
    if (tipo === 'busqueda') {
        busquedaActual = '';
        if(document.getElementById('input-busqueda')) document.getElementById('input-busqueda').value = '';
        document.querySelectorAll('.btn-marca-filtro').forEach(b => { b.style.background = '#f0f0f0'; b.style.color = '#333'; });
        const btnTodas = document.querySelector('.btn-marca-filtro[onclick*="todas"]');
        if(btnTodas) { btnTodas.style.background = '#2c3e50'; btnTodas.style.color = 'white'; }
    }
    if (tipo === 'coche') {
        cocheActual = ''; 
        const selectGaraje = document.getElementById('filtro-garaje');
        if (selectGaraje) selectGaraje.value = ''; 
    }
    if (tipo === 'marca') {
        marcaActual = '';
        document.querySelectorAll('.btn-marca-filtro').forEach(b => { b.style.background = '#f0f0f0'; b.style.color = '#333'; });
        const btnTodas = document.querySelector('.btn-marca-filtro[onclick*="todas"]');
        if(btnTodas) { btnTodas.style.background = '#2c3e50'; btnTodas.style.color = 'white'; }
    }
    renderizarVista();
}

// ==========================================
// 4. EL RENDERIZADOR PRINCIPAL
// ==========================================
function renderizarVista() {
    const contenedor = document.getElementById('almacen-piezas');
    if(!contenedor) return;

    if (cargandoInventario) {
        contenedor.innerHTML = `
            <div style="grid-column: 1 / -1; text-align:center; padding:80px 20px; background:white; border-radius:15px; border:1px solid #eee; box-shadow:0 10px 30px rgba(0,0,0,0.05);">
                <div style="width:50px; height:50px; border:5px solid #f3f3f3; border-top:5px solid #e74c3c; border-radius:50%; animation: girar 1s linear infinite; margin:0 auto 20px;"></div>
                <h3 style="color:#2d3436; margin:0; font-size:1.4em;">Sincronizando almacén...</h3>
            </div>`;
        return; 
    }

    if (sessionActiva && rutaActual === 'perfil') {
        if (typeof dibujarPanelPerfil === 'function') dibujarPanelPerfil(contenedor);
        return; 
    }

    const termino = busquedaActual.toLowerCase();
    // VARIABLE SEGURA DESDE SUPABASE
    let misFavoritos = (sessionActiva && Array.isArray(favoritosNube)) ? favoritosNube : [];

    let filtradas = inventarioNube.filter(p => {
        if (rutaActual === 'favoritos') return misFavoritos.includes(p.referencia);
        let r = (rutaActual === 'inicio') || (p.seccion === rutaActual);
        let f = (filtroActual === 'todos') || (p.filtro === filtroActual);
        
        let m = (marcaActual === '') || (p.marca && p.marca.toLowerCase() === marcaActual.toLowerCase()); 
        
        let textoBusqueda = ((p.titulo||'') + (p.referencia||'') + (p.compatible_con||'')).toLowerCase();
        let b = termino === '' || textoBusqueda.includes(termino);
        let c = cocheActual === '' || (p.compatible_con && p.compatible_con.toLowerCase().includes(cocheActual.toLowerCase()));
        
        return r && f && m && b && c; 
    });

    filtradas.sort((a, b) => {
        const limpia = (p) => parseFloat(p ? p.toString().replace(/[^\d,-]/g, '').replace(',', '.') : 0);
        
        if (criterioOrden === 'nuevo') return new Date(b.created_at) - new Date(a.created_at);
        if (criterioOrden === 'barato') return limpia(a.precio) - limpia(b.precio);
        if (criterioOrden === 'caro') return limpia(b.precio) - limpia(a.precio);
        if (criterioOrden === 'nombre') return (a.titulo||'').localeCompare(b.titulo||'');
        return 0;
    });

    const totalPaginas = Math.ceil(filtradas.length / PIEZAS_POR_PAGINA);
    const inicioRecorte = (paginaActual - 1) * PIEZAS_POR_PAGINA;
    const piezasDeEstaPagina = filtradas.slice(inicioRecorte, inicioRecorte + PIEZAS_POR_PAGINA);

    let html = "";
    piezasDeEstaPagina.forEach(p => {
        let precioHtml = p.precio_antiguo 
            ? `<div style="display:flex; flex-direction:column;"><span style="text-decoration:line-through;color:#a4b0be;font-size:0.85em;">${p.precio_antiguo}</span><span style="color:#e74c3c;font-weight:900;font-size:1.6em;line-height:1;">${p.precio || '0€'} <span style="background:#ff7675;color:white;padding:2px 5px;border-radius:4px;font-size:0.4em;vertical-align:middle;">OFERTA</span></span></div>` 
            : `<span style="font-weight:900;font-size:1.6em;color:#2d3436;">${p.precio || 'Consultar'}</span>`;
            
        // PEGATINA DEL CORAZÓN (Limpia y a prueba de errores)
        let esFavorito = misFavoritos.includes(p.referencia);
        let pegatinaFav = esFavorito ? '<span style="position:absolute; top:10px; left:10px; background:white; border-radius:50%; padding:4px 6px; box-shadow:0 2px 8px rgba(0,0,0,0.2); z-index:10; font-size:1.2em;" title="Guardado en favoritos">❤️</span>' : '';
        
        let agotado = p.stock !== undefined && p.stock <= 0;
        let cartelAgotado = agotado ? '<div style="position:absolute;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-10deg);background:rgba(231,76,60,0.95);color:white;padding:8px 20px;font-size:1.4em;font-weight:900;border:3px solid white;border-radius:8px;z-index:20;box-shadow:0 5px 15px rgba(0,0,0,0.3);letter-spacing:1px;white-space:nowrap;">AGOTADO</div>' : '';
        let btnAñadir = agotado ? `<button disabled style="flex:2; padding:10px; background:#bdc3c7; color:white; border:none; border-radius:6px; cursor:not-allowed; font-weight:bold;">❌ Sin Stock</button>` : `<button onclick="añadirAlCarrito('${p.referencia}', event)" class="btn-rojo" style="flex:2; padding:10px;">🛒 Añadir</button>`;
        let estiloTarjeta = agotado ? 'opacity:0.75; filter:grayscale(80%);' : '';

        html += `
            <div class="tarjeta-recambio-limpia" style="${estiloTarjeta} position:relative;">
                ${pegatinaFav}
                ${p.destacado && !agotado ? '<span class="etiqueta-recomendado" style="position:absolute; top:10px; right:10px; background:var(--naranja-accent); color:white; padding:4px 8px; border-radius:4px; font-size:0.7em; font-weight:bold; z-index:5;">⭐ RECOMENDADO</span>' : ''}
                
                <div class="zona-foto-tarjeta" onclick="abrirModal('${p.referencia}')">
                    <img src="${p.foto_url || 'https://via.placeholder.com/300'}" alt="${p.titulo || 'Pieza'}">
                </div>
                
                <div class="zona-info-tarjeta">
                    <div class="fila-estado-ref">
                        <span class="etiqueta-estado">${p.estado === 'Nuevo' ? 'NUEVO' : 'REVISADO'}</span>
                        <span class="etiqueta-ref" title="Ref: ${p.referencia}">Ref: ${p.referencia}</span>
                    </div>
                    
                    <h3 onclick="abrirModal('${p.referencia}')">${p.titulo || 'Pieza sin título'}</h3>
                    
                    <div class="zona-precio-tarjeta">
                        ${p.precio_antiguo ? `<span class="precio-tachado">${p.precio_antiguo}</span>` : ''}
                        <div class="fila-precio-final">
                            <span class="precio-actual">${p.precio || 'Consultar'}</span>
                            ${p.precio_antiguo ? `<span class="etiqueta-oferta">OFERTA</span>` : ''}
                        </div>
                    </div>
                    
                    <div class="zona-boton-tarjeta">
                        ${agotado 
                            ? `<button disabled class="btn-agotado-tarjeta">❌ Sin Stock</button>` 
                            : `<button onclick="añadirAlCarrito('${p.referencia}', event)" class="btn-añadir-tarjeta">🛒 Añadir</button>`
                        }
                    </div>
                </div>
            </div>
        `;
    });
    
    contenedor.innerHTML = html || '<div style="width:100%; text-align:center; padding:60px;"><span style="font-size:3em;">🕵️‍♂️</span><h3 style="color:#636e72; margin-top:10px;">No encontramos piezas con esos filtros</h3></div>';
    actualizarEtiquetasFiltros(); dibujarPaginacion(totalPaginas); 
}

// ==========================================
// 5. MOTOR DE PAGINACIÓN, COMPARTIR Y FAVORITOS
// ==========================================
function dibujarPaginacion(totalPaginas) {
    const contenedor = document.getElementById('paginacion-contenedor');
    if (!contenedor) return;
    if (totalPaginas <= 1) { contenedor.innerHTML = ''; return; }

    let html = '';
    if (paginaActual > 1) html += `<button onclick="cambiarPagina(${paginaActual - 1})" class="btn-paginacion">⬅️ Anterior</button>`;
    for (let i = 1; i <= totalPaginas; i++) html += `<button onclick="cambiarPagina(${i})" class="btn-paginacion ${(i === paginaActual) ? 'activa' : ''}">${i}</button>`;
    if (paginaActual < totalPaginas) html += `<button onclick="cambiarPagina(${paginaActual + 1})" class="btn-paginacion">Siguiente ➡️</button>`;
    contenedor.innerHTML = html;
}

window.cambiarPagina = (nuevaPagina) => {
    paginaActual = nuevaPagina; renderizarVista();
    window.scrollTo({ top: document.getElementById('titulo-ruta') ? document.getElementById('titulo-ruta').offsetTop - 20 : 0, behavior: 'smooth' });
}

window.compartirPieza = (ref, e) => {
    if(e) e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?ref=${ref}`).then(() => mostrarNotificacionFlotante("🔗 Enlace copiado al portapapeles", "#2980b9"));
}

window.verFavoritos = async () => {
    if (!document.getElementById('almacen-piezas')) {
        window.location.href = "recambios.html?vista=favoritos";
        return;
    }
    if (!sessionActiva) {
        mostrarNotificacionFlotante("🔒 ¡Inicia sesión para ver tu lista de piezas guardadas!", "#e74c3c");
        window.abrirLogin();
        return;
    }
    document.querySelectorAll('.btn-ruta-v').forEach(b => { 
        b.style.background = 'white'; b.style.color = 'black'; b.style.borderColor = '#ddd'; 
        b.classList.remove('activo');
    });
    rutaActual = 'favoritos'; filtroActual = 'todos'; paginaActual = 1;
    if(document.getElementById('titulo-ruta')) document.getElementById('titulo-ruta').innerText = '❤️ Mis Favoritos';
    if(document.getElementById('bloque-subfiltros')) document.getElementById('bloque-subfiltros').style.display = 'none';
    renderizarVista();
};

window.toggleFavorito = async (ref, e) => {
    if(e) e.stopPropagation();
    if (!sessionActiva) { 
        mostrarNotificacionFlotante("🔒 Inicia sesión para guardar favoritos", "#e74c3c");
        window.abrirLogin(); 
        return; 
    }
    const indice = favoritosNube.indexOf(ref);
    const botonPulsado = e ? e.currentTarget : document.getElementById(`btn-fav-${ref}`);
    const btnM = document.getElementById(`btn-fav-modal-${ref}`);

    if (indice === -1) {
        favoritosNube.push(ref);
        if(botonPulsado){ botonPulsado.innerHTML = '❤️'; botonPulsado.classList.add('fav-activo'); }
        if(btnM){ btnM.innerHTML = '❤️'; btnM.classList.add('fav-activo'); }
        mostrarNotificacionFlotante("⭐ Guardado en tus favoritos", "#f39c12");
        await clienteSupabase.from('favoritos').insert([{ user_id: usuarioId, product_ref: ref }]);
    } else {
        favoritosNube.splice(indice, 1);
        if(botonPulsado){ botonPulsado.innerHTML = '🤍'; botonPulsado.classList.remove('fav-activo'); }
        if(btnM){ btnM.innerHTML = '🤍'; btnM.classList.remove('fav-activo'); }
        mostrarNotificacionFlotante("🗑️ Eliminado de favoritos", "#7f8c8d");
        if(rutaActual === 'favoritos') renderizarVista();
        await clienteSupabase.from('favoritos').delete().eq('user_id', usuarioId).eq('product_ref', ref);
    }
}

// ==========================================
// 6. SISTEMA DE MODAL (VENTANA DE DETALLES)
// ==========================================
window.abrirModal = (ref) => {
    const p = inventarioNube.find(item => item.referencia === ref);
    if (!p) return;
    
    let fotos = [p.foto_url || 'https://via.placeholder.com/300'];
    if (p.galeria) fotos = fotos.concat(p.galeria.split(',').map(s => s.trim()));
    let miniaturasHtml = fotos.length > 1 ? `<div class="contenedor-miniaturas" style="display:flex; gap:10px; overflow-x:auto; padding:10px; justify-content:center;">` + fotos.map((f, i) => `<img src="${f}" class="mini-foto ${i===0?'activa':''}" onclick="cambiarFoto(this, '${f}')" style="width:70px; height:70px; object-fit:cover; border:2px solid ${i===0?'#e74c3c':'#ddd'}; border-radius:8px; cursor:pointer; opacity:${i===0?'1':'0.6'}; transition:0.2s;">`).join('') + `</div>` : '';
    
    let esFav = sessionActiva && favoritosNube.includes(p.referencia);
    let agotado = p.stock !== undefined && p.stock <= 0;
    
    let btnAñadir = agotado 
        ? `<button disabled style="flex:2; text-align:center; padding:18px 20px; border-radius:8px; font-size:1.1em; background:#bdc3c7; color:white; border:none; cursor:not-allowed; font-weight:bold;">❌ Agotado temporalmente</button>` 
        : `<button onclick="añadirAlCarrito('${p.referencia}', event); cerrarModal()" class="btn-rojo" style="flex:2; text-align:center; padding:18px 20px; border-radius:8px; font-size:1.1em;">🛒 Añadir al Carrito</button>`;
        
    let avisoStock = agotado ? `<span style="background:#e74c3c; color:white; padding:4px 10px; border-radius:4px; font-size:0.8em; font-weight:bold; margin-left:10px; vertical-align:middle;">SIN STOCK</span>` : '';
    
    document.getElementById('modal-contenido-dinamico').innerHTML = `
        <div style="display:flex; flex-wrap:wrap;">
            <div style="flex:1 1 450px; background:#f8f9fa; padding:40px; display:flex; flex-direction:column; align-items:center; border-right:1px solid #eee;">
                <img id="foto-main" src="${fotos[0]}" style="width:100%; height:350px; object-fit:contain; mix-blend-mode:multiply; transition:opacity 0.2s; margin-bottom:25px; ${agotado ? 'filter:grayscale(80%);' : ''}">
                ${miniaturasHtml}
            </div>
            <div style="flex:1 1 350px; padding:50px; display:flex; flex-direction:column;">
                <span style="color:#a4b0be; font-weight:bold; font-size:0.9em; font-family:monospace;">REF: ${p.referencia} ${avisoStock}</span>
                <h2 style="margin:10px 0 20px 0; color:#2d3436; font-size:1.8em; line-height:1.2;">${p.titulo || 'Pieza sin título'}</h2>
                <div style="margin-bottom:25px; font-size:1.05em; color:#2d3436;">
                    <p style="margin:8px 0;"><strong>Marca:</strong> ${p.marca || 'Otras'}</p>
                    <p style="margin:8px 0;"><strong>Estado:</strong> ${p.estado || 'Revisado'}</p>
                    ${p.compatible_con ? `<p style="margin:8px 0;"><strong>Compatible con:</strong> ${p.compatible_con}</p>` : ''}
                </div>
                <div style="background:#f8f9fa; padding:20px; border-radius:8px; margin-bottom:30px; border:1px solid #eaeaea; flex-grow:1;">
                    <h4 style="margin-top:0; color:#2d3436; margin-bottom:10px; text-transform:uppercase; letter-spacing:1px; font-size:0.9em;">Especificaciones Técnicas</h4>
                    <p style="font-size:0.95em; color:#636e72; line-height:1.6; margin:0;">${p.descripcion_larga || 'Contacta para detalles técnicos específicos.'}</p>
                </div>
                
                <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-top:10px; gap:20px; border-top:1px solid #eee; padding-top:25px;">
                    <div>
                        <span style="font-size:0.8em; color:#a4b0be; text-transform:uppercase; font-weight:bold; letter-spacing:1px;">Precio Final</span><br>
                        <span style="font-size:2.8em; font-weight:900; color:${agotado ? '#bdc3c7' : '#e74c3c'}; line-height:1;">${p.precio || 'Consultar'}</span>
                    </div>
                    
                    <div style="display:flex; gap:10px;">
                        <button id="btn-fav-modal-${p.referencia}" onclick="toggleFavorito('${p.referencia}', event)" class="btn-icono-accion ${esFav ? 'fav-activo' : ''}" style="background:#f1f2f6; border:none; width:50px; height:50px; border-radius:50%; cursor:pointer; font-size:1.2em; transition:0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'" title="Guardar en favoritos">${esFav ? '❤️' : '🤍'}</button>
                        <button onclick="compartirPieza('${p.referencia}', event)" style="background:#f1f2f6; border:none; width:50px; height:50px; border-radius:50%; cursor:pointer; font-size:1.2em; transition:0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'" title="Copiar enlace de esta pieza">🔗</button>
                    </div>
                </div>
                
                <div style="display:flex; gap:10px; margin-top:20px; width:100%;">
                    ${btnAñadir}
                </div>
            </div>
        </div>`;
    document.getElementById('modal-producto').style.display = 'flex';
}

window.cambiarFoto = (el, url) => {
    document.getElementById('foto-main').style.opacity = '0';
    setTimeout(() => { document.getElementById('foto-main').src = url; document.getElementById('foto-main').style.opacity = '1'; }, 150);
    const miniaturas = el.parentElement.children;
    for(let i=0; i<miniaturas.length; i++) { miniaturas[i].style.borderColor = '#ddd'; miniaturas[i].style.opacity = '0.6'; }
    el.style.borderColor = '#e74c3c'; el.style.opacity = '1';
}

window.cerrarModal = () => document.getElementById('modal-producto').style.display = 'none';

// ==========================================
// 7. CARRITO DE COMPRAS & STRIPE REAL 💳
// ==========================================
window.abrirPanelCarrito = () => { document.getElementById('panel-carrito').style.right = '0'; document.getElementById('overlay-carrito').style.display = 'block'; }
window.cerrarPanelCarrito = () => { document.getElementById('panel-carrito').style.right = '-400px'; document.getElementById('overlay-carrito').style.display = 'none'; }

window.añadirAlCarrito = (ref, e) => {
    if(e) e.stopPropagation();
    const p = inventarioNube.find(item => item.referencia === ref);
    if (!p) return;

    if (p.stock !== undefined && p.stock <= 0) {
        return mostrarNotificacionFlotante("⚠️ Esta pieza está agotada", "#e74c3c");
    }

    let itemExistente = carrito.find(item => item.referencia === ref);
    let cantActual = itemExistente ? (itemExistente.cantidad || 1) : 0;

    if (p.stock !== undefined && (cantActual + 1) > p.stock) {
        return mostrarNotificacionFlotante(`⚠️ Lo sentimos, solo nos quedan ${p.stock} en stock`, "#f39c12");
    }

    if (itemExistente) {
        itemExistente.cantidad = cantActual + 1;
    } else {
        carrito.push({ ...p, cantidad: 1 });
    }
    
    localStorage.setItem('mi_carrito', JSON.stringify(carrito));
    actualizarInterfazCarrito();
    const cont = document.getElementById('contenedor-carrito-nav');
    if(cont) { cont.style.transform = 'scale(1.3)'; setTimeout(() => cont.style.transform = 'scale(1)', 200); }
    mostrarNotificacionFlotante("🛒 Añadido a la cesta correctamente", "#27ae60");
}

function actualizarInterfazCarrito() {
    const lista = document.getElementById('lista-carrito');
    const contadores = document.querySelectorAll('#contador-carrito');
    const totalTxt = document.getElementById('total-precio-carrito');

    let totalArticulos = carrito.reduce((sum, item) => sum + (item.cantidad || 1), 0);

    if (carrito.length === 0) {
        if(lista) lista.innerHTML = '<div style="text-align:center; padding:40px;"><span style="font-size:3em;">🛒</span><p style="color:#aaa; margin-top:10px;">Tu cesta está vacía...</p></div>';
        contadores.forEach(c => c.style.display = 'none');
        if(totalTxt) totalTxt.innerText = '0.00€';
        return;
    }

    contadores.forEach(c => { c.innerText = totalArticulos; c.style.display = 'block'; });

    let html = ''; let sumaTotal = 0;
    carrito.forEach((p, index) => {
        let cantidad = p.cantidad || 1;
        let prec = p.precio ? parseFloat(p.precio.replace(/[^\d,]/g, '').replace(',', '.')) : 0;
        sumaTotal += isNaN(prec) ? 0 : (prec * cantidad);

        html += `<div style="display:flex; align-items:center; gap:15px; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                <img src="${p.foto_url || 'https://via.placeholder.com/50'}" style="width:50px; height:50px; object-fit:contain; background:#f9f9f9; border-radius:5px;">
                <div style="flex-grow:1;">
                    <h4 style="font-size:0.9em; margin:0; color:#2c3e50;">${p.titulo} <span style="background:#e74c3c; color:white; padding:2px 6px; border-radius:10px; font-size:0.8em; margin-left:5px;">x${cantidad}</span></h4>
                    <span style="color:#e74c3c; font-weight:bold;">${p.precio || '0€'}</span>
                </div>
                <span onclick="eliminarDelCarrito(${index})" style="cursor:pointer; color:#e74c3c; font-weight:bold; font-size:1.5em; background:#fdf2f2; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:8px;" title="Quitar uno">-</span>
            </div>`;
    });
    if(lista) lista.innerHTML = html;
    if(totalTxt) totalTxt.innerText = sumaTotal.toFixed(2) + '€';
}

window.eliminarDelCarrito = (index) => { 
    if (carrito[index].cantidad > 1) {
        carrito[index].cantidad--;
    } else {
        carrito.splice(index, 1); 
    }
    localStorage.setItem('mi_carrito', JSON.stringify(carrito)); 
    actualizarInterfazCarrito(); 
}

window.comprobarCheckout = async () => {
    if (carrito.length === 0) {
        mostrarNotificacionFlotante("⚠️ No puedes pagar con la cesta vacía", "#e74c3c");
        return;
    }
    
    if (!sessionActiva) {
        mostrarNotificacionFlotante("🔒 Inicia sesión para tramitar el pago", "#f39c12");
        window.cerrarPanelCarrito(); 
        window.abrirLogin();
        return; 
    } 
    
    const checkboxLegal = document.getElementById('checkbox-legal-carrito');
    if (checkboxLegal && !checkboxLegal.checked) {
        mostrarNotificacionFlotante("⚠️ Debes aceptar las Condiciones de Venta y Devolución antes de pagar", "orange");
        checkboxLegal.parentElement.style.color = '#e74c3c';
        setTimeout(() => checkboxLegal.parentElement.style.color = '#7f8c8d', 1000);
        return;
    }

    const btnCheckout = document.querySelector('#footer-carrito button');
    const txtOriginal = btnCheckout.innerHTML;
    btnCheckout.innerHTML = "Conectando con el banco... 🔐";
    btnCheckout.style.background = "#27ae60";
    btnCheckout.disabled = true;

    let sumaTotal = 0;
    carrito.forEach(p => {
        let cantidad = p.cantidad || 1;
        let prec = p.precio ? parseFloat(p.precio.replace(/[^\d,]/g, '').replace(',', '.')) : 0;
        sumaTotal += isNaN(prec) ? 0 : (prec * cantidad);
    });

    const { data: pedidoData, error: pedidoError } = await clienteSupabase
        .from('pedidos')
        .insert([{ 
            user_id: usuarioId, 
            total: sumaTotal, 
            articulos: carrito,
            estado: 'Pendiente de pago ⏳'
        }])
        .select(); 

    if (pedidoError || !pedidoData || pedidoData.length === 0) {
        console.error("Error al crear pedido:", pedidoError);
        mostrarNotificacionFlotante("❌ Hubo un error de conexión", "#e74c3c");
        btnCheckout.innerHTML = txtOriginal;
        btnCheckout.style.background = "#e74c3c";
        btnCheckout.disabled = false;
        return;
    }

    const miPedidoId = pedidoData[0].id;

    const carritoParaStripe = carrito.map(p => ({
        referencia: p.referencia, 
        cantidad: p.cantidad || 1 
    }));

    const { data: stripeData, error: stripeError } = await clienteSupabase.functions.invoke('crear-pago-stripe', {
        body: { pedido_id: miPedidoId, articulos: carritoParaStripe }
    });

    if (stripeError) {
        console.error("Error al llamar a Stripe:", stripeError);
        mostrarNotificacionFlotante("❌ Error conectando con la pasarela de pago", "#e74c3c");
        btnCheckout.innerHTML = txtOriginal;
        btnCheckout.style.background = "#e74c3c";
        btnCheckout.disabled = false;
    } else if (stripeData && stripeData.url) {
        window.location.href = stripeData.url; 
    } else {
        mostrarNotificacionFlotante("❌ El banco no respondió correctamente", "#e74c3c");
        btnCheckout.innerHTML = txtOriginal;
        btnCheckout.style.background = "#e74c3c";
        btnCheckout.disabled = false;
    }
};

// ==========================================
// 8. SISTEMA DE USUARIOS Y LOGIN
// ==========================================
window.abrirLogin = () => document.getElementById('modal-login').style.display = 'flex';
window.cerrarLogin = () => document.getElementById('modal-login').style.display = 'none';

window.cambiarModoAuth = () => {
    const card = document.getElementById('auth-card'); const titulo = document.getElementById('titulo-login');
    const subtitulo = document.getElementById('subtitulo-login'); const btn = document.getElementById('btn-accion-login');
    const icono = document.getElementById('icono-auth'); const link = document.getElementById('link-cambio-auth');
    const textoC = document.getElementById('texto-cambio-auth'); const cajaReglas = document.getElementById('reglas-pass');
    const cajaRecup = document.getElementById('contenedor-recuperar');

    icono.classList.add('icono-girar'); setTimeout(() => icono.classList.remove('icono-girar'), 500);

    if (titulo.innerText === 'Iniciar Sesión') {
        if(card) card.classList.add('modo-registro-activo');
        titulo.innerText = 'Nueva Cuenta'; subtitulo.innerText = 'Regístrate en menos de 1 minuto ⏱️';
        btn.innerText = 'ARRANCAR MI CUENTA 🏁'; btn.style.background = '#27ae60';
        icono.innerText = '🏁'; textoC.innerText = '¿Ya tienes cuenta?'; link.innerText = 'Iniciar sesión ahora'; link.style.color = '#27ae60';
        if(cajaReglas) cajaReglas.style.display = 'block';
        if(cajaRecup) cajaRecup.style.display = 'none';
    } else {
        if(card) card.classList.remove('modo-registro-activo');
        titulo.innerText = 'Iniciar Sesión'; subtitulo.innerText = 'Acceso para clientes de La Estación';
        btn.innerText = 'ENTRAR'; btn.style.background = '#e74c3c';
        icono.innerText = '🔑'; textoC.innerText = '¿Eres nuevo por aquí?'; link.innerText = 'Crear una cuenta nueva'; link.style.color = '#e74c3c';
        if(cajaReglas) cajaReglas.style.display = 'none';
        if(cajaRecup) cajaRecup.style.display = 'block';
    }
}

window.recuperarPass = async function() {
    const email = document.getElementById('email-login').value;
    if (!email) return mostrarMensajeAuth("⚠️ Escribe tu email arriba para enviar el enlace", "orange");
    
    const btn = document.getElementById('btn-accion-login');
    const txtO = btn.innerText;
    btn.innerText = "Enviando... ✉️"; btn.disabled = true;

    const rutaCompleta = window.location.origin + window.location.pathname.split('index.html')[0] + 'index.html';

    const { error } = await clienteSupabase.auth.resetPasswordForEmail(email, { 
        redirectTo: rutaCompleta 
    });
    
    error ?
        mostrarMensajeAuth("❌ " + error.message, "#ff7675") : 
        mostrarMensajeAuth("✅ Revisa tu email para cambiar la clave", "#55efc4");
        
    btn.innerText = txtO;
    btn.disabled = false;
}
// ⚡ NUEVA VENTANA EXCLUSIVA PARA RECUPERAR CONTRASEÑA
window.abrirRecuperarPass = function() {
    // Cerramos la ventana de login normal para que no estorbe
    const modalLogin = document.getElementById('modal-login');
    if (modalLogin) modalLogin.style.display = 'none';

    let modal = document.getElementById('modal-recuperar-custom');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-recuperar-custom';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);';
        modal.innerHTML = `
            <div style="background:white; padding:40px; border-radius:20px; text-align:center; max-width:450px; width:90%; box-shadow:0 10px 40px rgba(0,0,0,0.3); position:relative;">
                <span onclick="document.getElementById('modal-recuperar-custom').style.display='none'" style="position:absolute; top:15px; right:20px; font-size:1.8em; cursor:pointer; color:#7f8c8d;">&times;</span>
                <div style="font-size: 3.5em; margin-bottom: 10px;">🆘</div>
                <h2 style="margin-top:0; color:#2c3e50;">Recuperar Llave</h2>
                <p style="color:#636e72; margin-bottom:25px; font-size: 1.05em; line-height: 1.4;">Escribe el correo electrónico asociado a la cuenta a la cual quieres restablecer la contraseña.</p>
                <input type="email" id="input-email-recuperar" placeholder="tu@email.com" style="width:100%; padding:15px; border:2px solid #eee; border-radius:8px; font-size:1.1em; margin-bottom:20px; box-sizing:border-box; outline:none; text-align:center;">
                <button id="btn-enviar-recuperacion" onclick="ejecutarRecuperacionExclusiva()" style="width:100%; padding:15px; background:#e74c3c; color:white; border:none; border-radius:8px; font-weight:bold; font-size:1.1em; cursor:pointer; transition:0.2s;">Enviar enlace de recuperación ✉️</button>
                <p id="mensaje-recuperacion" style="display:none; margin-top:15px; font-weight:bold; padding:10px; border-radius:8px; font-size:0.9em;"></p>
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('input-email-recuperar').value = '';
    document.getElementById('mensaje-recuperacion').style.display = 'none';
    const btn = document.getElementById('btn-enviar-recuperacion');
    btn.disabled = false; btn.innerText = 'Enviar enlace de recuperación ✉️'; btn.style.background = '#e74c3c';
    modal.style.display = 'flex';
};

window.ejecutarRecuperacionExclusiva = async function() {
    const email = document.getElementById('input-email-recuperar').value.trim();
    const msg = document.getElementById('mensaje-recuperacion');
    const btn = document.getElementById('btn-enviar-recuperacion');

    if (!email || !email.includes('@')) {
        msg.innerText = "⚠️ Por favor, escribe un email válido."; msg.style.color = "orange"; msg.style.background = "#fff3cd"; msg.style.display = "block"; return;
    }

    btn.innerText = "Enviando... ⏳"; btn.disabled = true;
    const rutaCompleta = window.location.origin + window.location.pathname.split('index.html')[0] + 'index.html';
    const { error } = await clienteSupabase.auth.resetPasswordForEmail(email, { redirectTo: rutaCompleta });

    if (error) {
        msg.innerText = "❌ Error: " + error.message; msg.style.color = "#e74c3c"; msg.style.background = "#fadbd8"; msg.style.display = "block";
        btn.innerText = 'Intentar de nuevo'; btn.disabled = false;
    } else {
        msg.innerText = "✅ ¡Enlace enviado! Revisa tu email (o la carpeta de Spam)."; msg.style.color = "#27ae60"; msg.style.background = "#d4edda"; msg.style.display = "block";
        btn.innerText = '¡Conseguido! 🎉'; btn.style.background = '#27ae60';
    }
};

window.loginGoogle = async function() {
    const { error } = await clienteSupabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) mostrarMensajeAuth("❌ Error al conectar con Google", "#ff7675");
}

window.procesarAuth = async function() {
    const email = document.getElementById('email-login').value; const pass = document.getElementById('pass-login').value;
    const titulo = document.getElementById('titulo-login').innerText; const btn = document.getElementById('btn-accion-login');
    if (!email || !pass) return mostrarMensajeAuth("⚠️ Rellena todos los campos", "orange");
    if (titulo === 'Nueva Cuenta' && (pass.length < 6 || !/\d/.test(pass))) return mostrarMensajeAuth("⚠️ La contraseña no es segura", "orange");

    btn.innerText = "Conectando... ⚙️"; btn.disabled = true;
    let res = (titulo === 'Iniciar Sesión') ? await clienteSupabase.auth.signInWithPassword({ email, password: pass }) : await clienteSupabase.auth.signUp({ email, password: pass });
    
    if (res.error) {
        mostrarMensajeAuth("❌ " + res.error.message, "#ff7675");
        btn.innerText = (titulo === 'Iniciar Sesión' ? "ENTRAR" : "ARRANCAR MI CUENTA 🏁"); 
        btn.disabled = false;

        const inputPass = document.getElementById('pass-login');
        if (inputPass) {
            inputPass.value = ''; 
            inputPass.classList.add('animacion-error'); 
            setTimeout(() => inputPass.classList.remove('animacion-error'), 400);
        }
    } else {
        mostrarNotificacionFlotante(titulo === 'Iniciar Sesión' ? "¡Hola de nuevo! 👋" : "¡Bienvenida/o! 🌟", "#27ae60");
        setTimeout(() => { cerrarLogin(); btn.disabled = false; }, 1000);
    }
}

function mostrarMensajeAuth(texto, color) {
    const div = document.getElementById('mensaje-auth');
    if(div) { div.innerText = texto; div.style.display = 'block'; div.style.backgroundColor = color + "22"; div.style.color = color; }
}

function mostrarNotificacionFlotante(mensaje, color = "#2c3e50") {
    const vieja = document.getElementById('notificacion-flotante');
    if (vieja) vieja.remove();
    const toast = document.createElement('div');
    toast.id = 'notificacion-flotante';
    toast.innerText = mensaje;
    toast.style.cssText = `position:fixed; bottom:30px; right:30px; background:${color}; color:white; padding:15px 25px; border-radius:10px; box-shadow:0 10px 25px rgba(0,0,0,0.2); z-index:9999; font-weight:bold; transform:translateY(100px); opacity:0; transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; }, 10);
    setTimeout(() => { toast.style.transform = 'translateY(20px)'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

window.cerrarSesionSegura = function() {
    let modal = document.getElementById('modal-logout-custom');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-logout-custom';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);';
        modal.innerHTML = `
            <div style="background:white; padding:30px; border-radius:15px; text-align:center; max-width:400px; width:90%; box-shadow:0 10px 40px rgba(0,0,0,0.3); transition:0.2s;">
                <div style="font-size: 3.5em; margin-bottom: 10px;">👋</div>
                <h3 style="margin-top:0; color:#2c3e50; font-size:1.6em;">¿Te vas ya del taller?</h3>
                <p style="color:#636e72; margin-bottom:25px; font-size: 1.05em;">¿Seguro que quieres cerrar la sesión? Tendrás que volver a usar tu llave para entrar.</p>
                <div style="display:flex; gap:10px;">
                    <button onclick="document.getElementById('modal-logout-custom').style.display='none'" style="flex:1; padding:12px; border:none; background:#f1f2f6; color:#2d3436; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1.1em;">Cancelar</button>
                    <button onclick="ejecutarCierreSesion()" style="flex:1; padding:12px; border:none; background:#e74c3c; color:white; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1.1em;">Sí, salir</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
};

window.ejecutarCierreSesion = async () => {
    document.getElementById('modal-logout-custom').style.display = 'none';
    await clienteSupabase.auth.signOut();
    window.location.href = 'index.html'; 
};

window.abrirPestanaPerfil = (id) => {
    document.querySelectorAll('.contenido-perfil-tab').forEach(t => t.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    mostrarNotificacionFlotante("Cargando datos...", "#34495e");
}

// ==========================================
// 9. EVENTOS GENERALES Y CARGA INICIAL
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    
    if (window.location.href.includes('session_id=')) {
        carrito = [];
        localStorage.setItem('mi_carrito', JSON.stringify(carrito));
        setTimeout(() => mostrarNotificacionFlotante("🎉 ¡Pago completado con éxito!", "#27ae60"), 500);
    }

    actualizarInterfazCarrito();
    console.log("🚀 ARRANCANDO MOTOR LINEAL...");

    const { data: authData, error: authErr } = await clienteSupabase.auth.getSession();
    const session = authData.session;

    if (session) {
        if (session.user.email === 'davidherrerogarcia12@gmail.com') { 
            const linkAdmin = document.getElementById('link-admin-peticiones');
            if(linkAdmin) linkAdmin.style.display = 'block';
            const linkAdminPedidos = document.getElementById('link-admin-pedidos');
            if(linkAdminPedidos) linkAdminPedidos.style.display = 'block';
            const linkAdminPiezas = document.getElementById('link-admin-piezas');
            if(linkAdminPiezas) linkAdminPiezas.style.display = 'block';
        }

        console.log("👤 Sesión activa confirmada:", session.user.email);
        sessionActiva = true; 
        usuarioId = session.user.id;
        
        console.log("⏳ Descargando favoritos...");
        try {
            const { data, error } = await clienteSupabase.from('favoritos').select('product_ref').eq('user_id', usuarioId);
            if (data) favoritosNube = data.map(f => f.product_ref);
        } catch (err) {
            console.error("Fallo favoritos:", err);
        }
        console.log("🚗 Descargando mis coches...");
        await window.cargarMisCoches();

        console.log("📦 Descargando historial de pedidos...");
        await window.cargarMisPedidos();

        const btnU = document.querySelectorAll('#btn-usuario-nav'); 
        btnU.forEach(btn => {
            btn.innerHTML = `⚙️ Mi Panel de Control`;
            btn.onclick = () => window.location.href = 'perfil.html';
            btn.style.color = "#27ae60"; btn.style.borderColor = "#27ae60";
            btn.style.background = "#f0fff4";
        });
        
        const emailText = document.getElementById('texto-email-perfil');
        if(emailText) emailText.innerText = session.user.email;

    } else {
        console.log("🕵️‍♂️ Usuario visitante (Sin sesión)");
        sessionActiva = false; usuarioId = null; favoritosNube = [];
        const btnU = document.querySelectorAll('#btn-usuario-nav');
        btnU.forEach(btn => {
            btn.innerHTML = "👤 Mi Cuenta"; btn.onclick = abrirLogin; btn.style.color = "#1a252f"; btn.style.borderColor = "#1a252f"; btn.style.background = "transparent";
        });
        if (window.location.pathname.includes('perfil.html')) window.location.href = 'index.html';
    }

    console.log("📦 Ordenando descarga del catálogo principal...");
    await cargarPiezasDesdeLaNube();

    let modoRecuperacion = window.location.href.includes('type=recovery');

    // ⚡ DETECTOR ULTRA-SENSIBLE DE RECUPERACIÓN DE CONTRASEÑA
    // Comprobamos tanto la URL limpia como los fragmentos ocultos (#)
    let modoRecuperacion = window.location.href.includes('type=recovery') || window.location.hash.includes('type=recovery');

    clienteSupabase.auth.onAuthStateChange((event, nuevaSesion) => {
        console.log("📡 Evento de seguridad detectado:", event); 
        
        // Si Supabase nos dice que es una recuperación, o lo vemos en la URL, abrimos la ventana
        if (event === 'PASSWORD_RECOVERY' || modoRecuperacion) {
            console.log("🔑 Modo recuperación activado. Abriendo ventana...");
            
            // Forzamos que la variable sea true para que no se cierre
            modoRecuperacion = true; 
            
            // Esperamos un pelín a que cargue bien la página y lanzamos el modal
            setTimeout(() => {
                if (typeof window.mostrarVentanaNuevaPass === "function") {
                    window.mostrarVentanaNuevaPass();
                }
            }, 500); 
        } else if (event === 'SIGNED_IN' && !sessionActiva && !modoRecuperacion) {
            window.location.reload();
        } else if (event === 'SIGNED_OUT' && sessionActiva) {
            window.location.reload();
        }
    });

window.mostrarVentanaNuevaPass = function() {
    if(document.getElementById('modal-cambio-pass')) return; 

    const modal = document.createElement('div');
    modal.id = 'modal-cambio-pass';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px);';
    
    modal.innerHTML = `
        <div style="background:white; padding:40px; border-radius:15px; text-align:center; max-width:400px; width:90%; box-shadow:0 10px 40px rgba(0,0,0,0.3);">
            <div style="font-size: 3.5em; margin-bottom: 10px;">🔐</div>
            <h2 style="color:#2c3e50; margin-top:0; margin-bottom:10px;">Nueva Contraseña</h2>
            <p style="color:#7f8c8d; margin-bottom:25px; font-size:0.95em;">Escribe tu nueva llave de acceso para el taller.</p>
            <input type="password" id="input-nueva-pass" placeholder="Mínimo 6 caracteres" style="width:100%; padding:15px; border:2px solid #eee; border-radius:8px; font-size:1.1em; margin-bottom:20px; box-sizing:border-box; outline:none; text-align:center;">
            <button id="btn-guardar-pass" onclick="ejecutarCambioPass()" style="width:100%; padding:15px; background:#27ae60; color:white; border:none; border-radius:8px; font-weight:bold; font-size:1.1em; cursor:pointer; transition:0.2s;">Guardar Contraseña</button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.ejecutarCambioPass = async function() {
    const nueva = document.getElementById('input-nueva-pass').value;
    if (nueva.length < 6) return alert("⚠️ La contraseña debe tener al menos 6 caracteres.");
    
    const btn = document.getElementById('btn-guardar-pass');
    btn.innerText = "Guardando... ⏳";
    btn.disabled = true;

    const { error } = await clienteSupabase.auth.updateUser({ password: nueva });

    if (error) {
        alert("❌ Error: " + error.message);
        btn.innerText = "Guardar Contraseña";
        btn.disabled = false;
    } else {
        alert("✅ ¡Contraseña actualizada con éxito! Entrando al taller...");
        window.location.hash = ''; 
        window.location.href = 'perfil.html'; 
    }
};

    const inputPass = document.getElementById('pass-login');
    if(inputPass) {
        inputPass.addEventListener('input', (e) => {
            const pass = e.target.value; const tieneLong = pass.length >= 6; const tieneNum = /\d/.test(pass);
            const rLon = document.getElementById('regla-longitud'); const rNum = document.getElementById('regla-numero');
            if(rLon) { rLon.innerHTML = tieneLong ? '✅ Mínimo 6 caracteres' : '❌ Mínimo 6 caracteres'; rLon.style.color = tieneLong ? '#27ae60' : '#e74c3c'; }
            if(rNum) { rNum.innerHTML = tieneNum ? '✅ Debe contener un número' : '❌ Debe contener un número'; rNum.style.color = tieneNum ? '#27ae60' : '#e74c3c'; }
        });
        inputPass.addEventListener('keypress', (e) => { if (e.key === 'Enter') procesarAuth(); });
    }

    const btnFiltros = document.getElementById('btn-toggle-filtros');
    const sidebar = document.querySelector('.sidebar-filtros');
    if (btnFiltros && sidebar) {
        btnFiltros.addEventListener('click', () => {
            sidebar.classList.toggle('abierta');
            btnFiltros.innerHTML = sidebar.classList.contains('abierta') ? '❌ Ocultar Filtros' : '⚙️ Mostrar Filtros';
            btnFiltros.style.background = sidebar.classList.contains('abierta') ? '#e74c3c' : '#2c3e50';
        });
    }

    document.querySelectorAll('.btn-ruta-v').forEach(boton => {
        boton.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-ruta-v').forEach(b => { b.style.background = 'white'; b.style.color = 'black'; b.style.borderColor = '#ddd'; });
            rutaActual = e.target.getAttribute('data-ruta');
            if(rutaActual === 'favoritos') {
                e.target.style.background = '#fffbe8'; e.target.style.color = '#d6a200'; e.target.style.borderColor = '#ffd32a';
                if(document.getElementById('titulo-ruta')) document.getElementById('titulo-ruta').innerText = '⭐ Mis Favoritos';
                if(!sessionActiva) { mostrarNotificacionFlotante("⚠️ Inicia sesión para ver tus piezas guardadas.", "#f39c12"); abrirLogin(); }
            } else {
                e.target.style.background = '#e74c3c'; e.target.style.color = 'white'; e.target.style.borderColor = '#e74c3c';
                if(document.getElementById('titulo-ruta')) document.getElementById('titulo-ruta').innerText = rutaActual === 'inicio' ? 'Catálogo General' : 'Sección: ' + rutaActual.charAt(0).toUpperCase() + rutaActual.slice(1);
                generarSubFiltros(); 
            }
            filtroActual = 'todos'; paginaActual = 1; renderizarVista();
        });
    });

    const inputB = document.getElementById('input-busqueda');
    if (inputB) {
        const formPadre = inputB.closest('form');
        if (formPadre) formPadre.addEventListener('submit', (e) => e.preventDefault());
        
        inputB.addEventListener('input', (e) => { busquedaActual = e.target.value; paginaActual = 1; document.querySelectorAll('.btn-marca-filtro').forEach(b => { b.style.background = '#f0f0f0'; b.style.color = '#333'; }); renderizarVista(); });
    }

    const selectorO = document.getElementById('ordenar-por');
    if (selectorO) selectorO.addEventListener('change', (e) => { criterioOrden = e.target.value; paginaActual = 1; renderizarVista(); });

}); 

// ==========================================
// 10. GESTIÓN DEL PERFIL PROFESIONAL
// ==========================================
window.guardarCoche = async function() {
    const inputCoche = document.getElementById('input-coche');
    if(!inputCoche) return;
    
    const vehiculo = inputCoche.value.trim();

    const palabras = vehiculo.split(/\s+/);
    if (vehiculo.length < 5 || palabras.length < 2) {
        mostrarNotificacionFlotante("⚠️ Formato incorrecto. Pon Marca y Modelo (Ej: Audi A3)", "#e74c3c");
        inputCoche.focus(); 
        return; 
    }

    if (!sessionActiva) {
        mostrarNotificacionFlotante("🔒 Inicia sesión para poder guardar tu coche.", "#f39c12");
        return;
    }

    const btn = event.target;
    const txtOriginal = btn.innerText;
    btn.innerText = "Guardando... ⏳";
    btn.disabled = true;

    const marcaCoche = palabras[0].toUpperCase();

    const { error } = await clienteSupabase.from('coches_clientes').insert([
        { user_id: usuarioId, marca: marcaCoche, modelo: vehiculo }
    ]);

    if (error) {
        console.error("Error al guardar coche:", error);
        mostrarNotificacionFlotante("❌ Hubo un error de conexión con el servidor", "#e74c3c");
    } else {
        mostrarNotificacionFlotante("🚗 Vehículo aparcado en tu garaje con éxito", "#27ae60");
        inputCoche.value = "";
        window.cargarMisCoches(); 
    }
    
    btn.innerText = txtOriginal;
    btn.disabled = false;
};

// ==========================================
// 11. SISTEMA AVANZADO DE GARAJE
// ==========================================
window.cargarMisCoches = async function() {
    const contenedor = document.getElementById('lista-mis-coches');
    const filtroGaraje = document.getElementById('filtro-garaje');
    
    if (!sessionActiva || !usuarioId) return;

    const { data: coches, error } = await clienteSupabase
        .from('coches_clientes')
        .select('*')
        .eq('user_id', usuarioId);

    if (error) {
        console.error("Error cargando coches:", error);
        return;
    }

    if (contenedor) {
        contenedor.innerHTML = "";
        if (coches.length === 0) {
            contenedor.innerHTML = "<p style='color: #7f8c8d;'>Tu garaje está vacío. ¡Añade tu primer coche arriba!</p>";
        } else {
            coches.forEach(coche => {
                contenedor.innerHTML += `
                    <div class="card-coche">
                        <h4>${coche.modelo}</h4>
                        <button class="btn-piezas" onclick="buscarPiezasRapido('${coche.modelo}')">🔍 Ver piezas compatibles</button>
                        <div class="acciones-coche">
                            <button class="btn-editar" onclick="editarCoche('${coche.id}', '${coche.modelo}')">✏️ Editar</button>
                            <button class="btn-borrar" onclick="borrarCoche('${coche.id}', '${coche.modelo}')">🗑️ Borrar</button>
                        </div>
                    </div>
                `;
            });
        }
    }

    if (filtroGaraje) {
        filtroGaraje.style.display = "inline-block"; 
        filtroGaraje.innerHTML = '<option value="">🚗 Mi Vehículo</option>';
        coches.forEach(coche => {
            filtroGaraje.innerHTML += `<option value="${coche.modelo}">${coche.modelo}</option>`;
        });
    }
};

function mostrarModalGaraje(tipo, idCoche, nombreCoche) {
    let modal = document.getElementById('modal-garaje-custom');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-garaje-custom';
        modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; align-items:center; justify-content:center; backdrop-filter:blur(3px);';
        modal.innerHTML = `
            <div style="background:white; padding:30px; border-radius:15px; text-align:center; max-width:400px; width:90%; box-shadow:0 10px 30px rgba(0,0,0,0.2); transform:scale(0.9); transition:0.2s;" id="caja-modal-garaje">
                <h3 id="titulo-modal-garaje" style="margin-top:0; color:#2c3e50; font-size:1.5em;">Título</h3>
                <p id="texto-modal-garaje" style="color:#636e72; margin-bottom:20px;">Texto</p>
                <input type="text" id="input-modal-garaje" style="display:none; width:90%; padding:12px; margin:0 auto 20px auto; border:2px solid #ddd; border-radius:8px; font-size:1.1em; text-align:center;" placeholder="Ej: Audi A3">
                <div style="display:flex; gap:10px;">
                    <button onclick="cerrarModalGaraje()" style="flex:1; padding:12px; border:none; background:#f1f2f6; color:#2d3436; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1em;">Cancelar</button>
                    <button id="btn-modal-garaje" style="flex:1; padding:12px; border:none; color:white; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1em;">Aceptar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const titulo = document.getElementById('titulo-modal-garaje');
    const texto = document.getElementById('texto-modal-garaje');
    const input = document.getElementById('input-modal-garaje');
    const btn = document.getElementById('btn-modal-garaje');
    const caja = document.getElementById('caja-modal-garaje');

    modal.style.display = 'flex';
    setTimeout(() => caja.style.transform = 'scale(1)', 10);

    if (tipo === 'borrar') {
        titulo.innerHTML = "🗑️ ¿Al desguace?";
        texto.innerText = `¿Seguro que quieres borrar tu ${nombreCoche} del garaje? Esta acción no se puede deshacer.`;
        input.style.display = 'none';
        btn.style.background = '#e74c3c';
        btn.innerText = 'Sí, Borrar';
        btn.onclick = async () => {
            cerrarModalGaraje();
            const { error } = await clienteSupabase.from('coches_clientes').delete().eq('id', idCoche);
            if (!error) { mostrarNotificacionFlotante("🚗 Coche eliminado", "#e74c3c"); window.cargarMisCoches(); }
        };
    } else if (tipo === 'editar') {
        titulo.innerHTML = "✏️ Editar Vehículo";
        texto.innerText = "Modifica la marca y modelo de tu coche:";
        input.style.display = 'block'; input.value = nombreCoche;
        btn.style.background = '#27ae60';
        btn.innerText = 'Guardar Cambios';
        btn.onclick = async () => {
            const nuevoNombre = input.value.trim();
            if (!nuevoNombre || nuevoNombre === nombreCoche) return cerrarModalGaraje();
            const palabras = nuevoNombre.split(/\s+/);
            if (nuevoNombre.length < 5 || palabras.length < 2) return alert("⚠️ Formato incorrecto. Pon Marca y Modelo (Ej: Audi A3)");
            
            cerrarModalGaraje();
            const { error } = await clienteSupabase.from('coches_clientes').update({ marca: palabras[0].toUpperCase(), modelo: nuevoNombre }).eq('id', idCoche);
            if (!error) { mostrarNotificacionFlotante("✅ Vehículo actualizado", "#27ae60"); window.cargarMisCoches(); }
        };
    }
}

window.cerrarModalGaraje = function() {
    const modal = document.getElementById('modal-garaje-custom');
    const caja = document.getElementById('caja-modal-garaje');
    if(modal && caja) { caja.style.transform = 'scale(0.9)'; setTimeout(() => modal.style.display = 'none', 150); }
};

window.borrarCoche = (id, nombre) => mostrarModalGaraje('borrar', id, nombre);
window.editarCoche = (id, nombre) => mostrarModalGaraje('editar', id, nombre);

window.buscarPiezasRapido = function(modelo) {
    if (!window.location.href.includes("recambios.html") && !window.location.href.includes("index.html")) {
        window.location.href = `recambios.html?coche=${encodeURIComponent(modelo)}`;
        return;
    }
    
    const selectGaraje = document.getElementById('filtro-garaje');
    if (selectGaraje) {
        selectGaraje.value = modelo;
        filtrarPorMiCoche();
    }
};

window.filtrarPorMiCoche = function() {
    const select = document.getElementById('filtro-garaje');
    if(!select) return;
    
    cocheActual = select.value; 
    paginaActual = 1; 
    renderizarVista(); 
};

// ==========================================
// 12. HISTORIAL DE PEDIDOS
// ==========================================
window.cargarMisPedidos = async function() {
    const contenedor = document.getElementById('lista-mis-pedidos');
    if (!contenedor || !sessionActiva || !usuarioId) return;

    const { data: pedidos, error } = await clienteSupabase
        .from('pedidos')
        .select('*')
        .eq('user_id', usuarioId)
        .neq('estado', 'Pendiente de pago ⏳') 
        .order('fecha', { ascending: false });

    if (error) {
        console.error("Error cargando pedidos:", error);
        contenedor.innerHTML = "<p style='color: #e74c3c;'>❌ Error al cargar el historial.</p>";
        return;
    }

    if (pedidos.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 10px; border: 1px dashed #ccc;">
                <span style="font-size: 3em;">🛒</span>
                <p style="color: #7f8c8d; margin-top: 10px;">Aún no has realizado ninguna compra.</p>
                <button onclick="window.location.href='recambios.html'" class="btn-rojo" style="margin-top: 15px; padding: 10px 20px;">Ir a la tienda</button>
            </div>
        `;
        return;
    }

    let html = '';
    
    pedidos.forEach(pedido => {
        const fechaObj = new Date(pedido.fecha);
        const opcionesFecha = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' };
        const fechaBonita = fechaObj.toLocaleDateString('es-ES', opcionesFecha);

        let articulosHtml = '';
        const listaArticulos = pedido.articulos || []; 
        listaArticulos.forEach(art => {
            articulosHtml += `
                <div class="articulo-pedido" style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px dashed #eee;">
                    <img src="${art.foto_url || 'https://via.placeholder.com/60'}" alt="Foto pieza" style="width: 60px; height: 60px; object-fit: contain; background: #f9f9f9; border-radius: 8px; border: 1px solid #eee;">
                    <div class="articulo-info" style="flex-grow: 1;">
                        <h4 style="margin: 0 0 5px 0; font-size: 1em; color: #2c3e50;">${art.titulo || 'Pieza'} <span style="background:#e74c3c; color:white; padding:2px 6px; border-radius:10px; font-size:0.8em; margin-left:5px;">x${art.cantidad || 1}</span></h4>
                        <span style="color: #7f8c8d; font-size: 0.85em; font-family: monospace; background: #f1f2f6; padding: 2px 6px; border-radius: 4px;">Ref: ${art.referencia || 'N/A'}</span>
                    </div>
                    <div style="font-weight: bold; color: #e74c3c; font-size: 1.1em;">
                        ${art.precio || '0€'}
                    </div>
                </div>
            `;
        });

        let direccionHtml = '';
        if (pedido.direccion_envio) {
            let dirLimpia = pedido.direccion_envio.replace(/\n/g, '<br>');
            direccionHtml = `
                <div style="background: #f1f2f6; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #3498db;">
                    <strong style="color: #2c3e50; font-size: 0.9em; text-transform: uppercase;">📍 Dirección de Envío:</strong><br>
                    <span style="color: #636e72; font-size: 0.95em; line-height: 1.5; display: inline-block; margin-top: 5px;">${dirLimpia}</span>
                </div>
            `;
        }

        let botonesCliente = '<div style="padding: 15px 20px; display: flex; gap: 10px; flex-wrap: wrap; border-top: 1px dashed #eee; background: #fff;">';
        
        if (pedido.estado !== 'Enviado' && pedido.estado !== 'Entregado' && pedido.estado !== 'Cancelado') {
            botonesCliente += `<button onclick="cancelarMiPedido('${pedido.id}')" style="background:#e74c3c; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold; box-shadow:0 2px 5px rgba(231,76,60,0.3);">❌ Cancelar Pedido</button>`;
        }
        
        if (pedido.estado === 'Enviado' || pedido.estado === 'Entregado') {
            const emailTaller = "giljulio9876@gmail.com"; 
            const asunto = encodeURIComponent(`Solicitud de Devolución - Pedido #${pedido.id}`);
            const cuerpo = encodeURIComponent(`Hola Taller La Estación,\n\nQuiero solicitar la devolución del pedido #${pedido.id}.\n\nEl motivo de la devolución es:\n[Escribe aquí tu motivo]\n\n* Entiendo que la pieza no puede mostrar signos de haber sido montada ni manchada de grasa, y debe ir en su embalaje original.\n\nSaludos.`);
            botonesCliente += `<a href="mailto:${emailTaller}?subject=${asunto}&body=${cuerpo}" style="background:#7f8c8d; color:white; text-decoration:none; padding:8px 15px; border-radius:5px; font-weight:bold; display:inline-block; box-shadow:0 2px 5px rgba(127,140,141,0.3);">📦 Solicitar Devolución</a>`;
        }
        botonesCliente += '</div>';

        html += `
            <div class="tarjeta-pedido" style="background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 20px;">
                <div class="cabecera-pedido" style="background: #2c3e50; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div class="info-pedido" style="color: white;">
                        <p style="margin: 0; font-size: 0.85em; color: #bdc3c7;">Pedido realizado: ${fechaBonita}</p>
                        <p style="margin: 0; font-size: 1.1em; font-weight: bold;">ID: <span style="font-family: monospace; color: #f1c40f;">#${pedido.id.toString().split('-')[0].toUpperCase()}</span></p>
                    </div>
                    <div class="estado-pedido" style="background: #27ae60; color: white; font-weight: bold; padding: 6px 15px; border-radius: 20px; font-size: 0.85em; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                        📦 ${pedido.estado}
                    </div>
                </div>
                
                <div class="cuerpo-pedido" style="padding: 20px;">
                    ${articulosHtml}
                    ${direccionHtml}
                </div>
                
                <div class="pie-pedido" style="background: #f8f9fa; padding: 15px 20px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <span style="color: #7f8c8d; font-size: 0.85em; background: #eef2f3; padding: 5px 10px; border-radius: 6px;">✉️ Factura oficial enviada al email</span>
                    <div style="text-align: right;">
                        <span style="color: #7f8c8d; font-size: 0.9em; margin-right: 10px;">Total pagado:</span>
                        <span style="font-size: 1.8em; font-weight: 900; color: #e74c3c;">${Number(pedido.total).toFixed(2)}€</span>
                    </div>
                </div>
                ${botonesCliente}
            </div>
        `;
    });

    contenedor.innerHTML = html;
};

// ==========================================
// 13. RADAR DE PETICIONES (Con verificación y Aviso)
// ==========================================
window.enviarPeticionRadar = function() {
    const coche = document.getElementById('radar-coche').value.trim();
    const pieza = document.getElementById('radar-pieza').value.trim();
    const contacto = document.getElementById('radar-contacto').value.trim();

    if (!coche || !pieza || !contacto) {
        mostrarNotificacionFlotante("⚠️ Por favor, rellena los 3 huecos para poder ayudarte.", "orange");
        return;
    }

    if (!contacto.includes('@')) {
        mostrarNotificacionFlotante("⚠️ El contacto debe ser un email válido (te falta poner la '@').", "orange");
        return;
    }

    confirmarPeticionRadar(coche, pieza, contacto);
};

window.confirmarPeticionRadar = function(coche, pieza, contacto) {
    let modal = document.getElementById('modal-radar-custom');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-radar-custom';
        modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; align-items:center; justify-content:center; backdrop-filter:blur(5px);';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div style="background:white; padding:30px; border-radius:15px; text-align:center; max-width:450px; width:90%; box-shadow:0 10px 40px rgba(0,0,0,0.3); transform:scale(0.9); transition:0.2s;" id="caja-modal-radar">
            <div style="font-size: 3.5em; margin-bottom: 10px;">👨‍🔧</div>
            <h3 style="margin-top:0; color:#2c3e50; font-size:1.6em;">¿Seguro que quieres pedir esto?</h3>
            <p style="color:#636e72; margin-bottom:25px; font-size: 1.05em; line-height: 1.6;">
                ¡Ojo! Al darle a aceptar <b>nos vas a mandar a trabajar</b> y a buscar esta pieza debajo de las piedras.<br><br>
                Si la encontramos a buen precio, te enviaremos un aviso directamente a <b style="color:#2c3e50;">${contacto}</b> para que puedas comprarla en la web. ¿Arrancamos la búsqueda?
            </p>
            <div style="display:flex; gap:10px;">
                <button onclick="cerrarModalRadar()" style="flex:1; padding:12px; border:none; background:#f1f2f6; color:#2d3436; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1.1em; transition:0.2s;">Pisar el freno</button>
                <button id="btn-confirmar-radar" style="flex:1; padding:12px; border:none; background:#e74c3c; color:white; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1.1em; transition:0.2s; box-shadow:0 4px 10px rgba(231,76,60,0.3);">¡Darle Gas! 🚀</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('caja-modal-radar').style.transform = 'scale(1)', 10);

    document.getElementById('btn-confirmar-radar').onclick = () => {
        cerrarModalRadar();
        ejecutarEnvioRadar(coche, pieza, contacto);
    };
};

window.cerrarModalRadar = function() {
    const modal = document.getElementById('modal-radar-custom');
    const caja = document.getElementById('caja-modal-radar');
    if(modal && caja) { 
        caja.style.transform = 'scale(0.9)'; 
        setTimeout(() => modal.style.display = 'none', 150); 
    }
};

window.ejecutarEnvioRadar = async function(coche, pieza, contacto) {
    mostrarNotificacionFlotante("Buscando proveedores... ⚙️", "#3498db");

    const { error } = await clienteSupabase.from('peticiones_piezas').insert([
        { coche: coche, pieza: pieza, contacto: contacto }
    ]);

    if (error) {
        console.error("Error al enviar petición:", error);
        mostrarNotificacionFlotante("❌ Hubo un fallo de conexión.", "#e74c3c");
    } else {
        mostrarNotificacionFlotante("✅ ¡Taller avisado! Revisa tu email los próximos días.", "#27ae60");
        document.getElementById('radar-coche').value = '';
        document.getElementById('radar-pieza').value = '';
        document.getElementById('radar-contacto').value = '';
    }
};

// ==========================================
// 14. GESTIÓN DE PETICIONES (MODO ADMIN)
// ==========================================
window.cargarPeticionesAdmin = async function() {
    const contenedor = document.getElementById('lista-peticiones-admin');
    if (!contenedor) return;

    const { data: peticiones, error } = await clienteSupabase
        .from('peticiones_piezas')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        contenedor.innerHTML = "<p style='color:red;'>Error al cargar: " + error.message + "</p>";
        return;
    }

    if (peticiones.length === 0) {
        contenedor.innerHTML = "<p style='text-align:center; color:#7f8c8d;'>No hay peticiones nuevas por ahora. ¡Buen trabajo!</p>";
        return;
    }

    let html = '';
    peticiones.forEach(p => {
        const fecha = new Date(p.created_at).toLocaleDateString();
        html += `
            <div style="background: white; border: 2px solid #eee; border-left: 5px solid #e74c3c; padding: 20px; border-radius: 10px; position: relative;">
                <span style="position: absolute; top: 10px; right: 15px; font-size: 0.8em; color: #aaa;">${fecha}</span>
                <h4 style="margin: 0 0 10px 0; color: #2c3e50;">🚗 Coche: ${p.coche}</h4>
                <p style="margin: 0 0 15px 0; color: #1a252f; font-weight: bold;">⚙️ Pieza: ${p.pieza}</p>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; display: inline-block;">
                    <span style="color: #7f8c8d; font-size: 0.9em;">Contacto:</span> 
                    <a href="mailto:${p.contacto}" style="color: #e74c3c; font-weight: bold; text-decoration: none;">${p.contacto}</a>
                </div>
            </div>
        `;
    });
    contenedor.innerHTML = html;
};

if (typeof window.abrirPestanaPerfil === "function") {
    const originalAbrirPestana = window.abrirPestanaPerfil;
    window.abrirPestanaPerfil = function(id) {
        originalAbrirPestana(id); 
        if (id === 'tab-peticiones') window.cargarPeticionesAdmin();
        if (id === 'tab-admin-pedidos') window.cargarTodosLosPedidosAdmin(); 
    };
}

// ==========================================
// 15. GESTIÓN GLOBAL DE PEDIDOS (MODO ADMIN)
// ==========================================
window.cargarTodosLosPedidosAdmin = async function() {
    const contenedor = document.getElementById('lista-pedidos-global');
    if (!contenedor) return;

    const { data: pedidos, error } = await clienteSupabase
        .from('pedidos')
        .select('*')
        .order('fecha', { ascending: false });

    if (error) {
        contenedor.innerHTML = "<p style='color:red;'>Error: " + error.message + "</p>";
        return;
    }

    let html = '';
    pedidos.forEach(p => {
        const items = JSON.parse(p.items || '[]');
        const fecha = new Date(p.fecha).toLocaleString();
        
        let colorEstado = "#f39c12"; 
        if(p.estado === 'Enviado') colorEstado = "#3498db";
        if(p.estado === 'Entregado') colorEstado = "#27ae60";
        if(p.estado === 'Cancelado') colorEstado = "#e74c3c";

        html += `
            <div style="background:white; border:1px solid #ddd; padding:20px; border-radius:10px; box-shadow:0 4px 6px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed #eee; padding-bottom:10px;">
                    <span><b>Pedido #${p.id.toString().slice(-5)}</b> - ${fecha}</span>
                    <span style="background:${colorEstado}; color:white; padding:4px 10px; border-radius:15px; font-size:0.85em; font-weight:bold;">${p.estado}</span>
                </div>
                <div style="margin-bottom:15px;">
                    <p style="margin:5px 0;">👤 <b>Cliente:</b> ${p.user_email}</p>
                    <p style="margin:5px 0;">📍 <b>Dirección:</b> ${p.direccion}</p>
                    <p style="margin:5px 0;">🛒 <b>Piezas:</b> ${items.map(i => i.titulo).join(', ')}</p>
                    <p style="margin:5px 0; font-size:1.2em; color:#2c3e50;">💰 <b>Total: ${p.total.toFixed(2)}€</b></p>
                </div>
                
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button onclick="cambiarEstadoPedido('${p.id}', 'Enviado')" style="background:#3498db; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">🚚 Marcar Enviado</button>
                    <button onclick="cambiarEstadoPedido('${p.id}', 'Entregado')" style="background:#27ae60; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">✅ Entregado</button>
                    <button onclick="cambiarEstadoPedido('${p.id}', 'Cancelado')" style="background:#e74c3c; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">❌ Cancelar y Avisar</button>
                </div>
            </div>
        `;
    });
    contenedor.innerHTML = html || "<p>No hay ventas registradas aún.</p>";
};

window.cambiarEstadoPedido = async function(id, nuevoEstado) {
    if(!confirm(`¿Seguro que quieres cambiar el pedido a "${nuevoEstado}"?`)) return;

    const { error } = await clienteSupabase
        .from('pedidos')
        .update({ estado: nuevoEstado })
        .eq('id', id);

    if (error) {
        mostrarNotificacionFlotante("❌ Error al actualizar estado", "#e74c3c");
    } else {
        mostrarNotificacionFlotante(`✅ Pedido actualizado a ${nuevoEstado}`, "#27ae60");
        window.cargarTodosLosPedidosAdmin();
    }
};

// ==========================================
// 16. CANCELAR MI PEDIDO (MODO CLIENTE)
// ==========================================
window.cancelarMiPedido = async function(id) {
    if(!confirm("⚠️ ¿Seguro que quieres cancelar este pedido?\n\nSi aceptas, cancelaremos el envío. El reembolso del dinero puede tardar unos días en aparecer en tu tarjeta.")) return;

    const { error } = await clienteSupabase
        .from('pedidos')
        .update({ estado: 'Cancelado' })
        .eq('id', id);

    if (error) {
        mostrarNotificacionFlotante("❌ Error al cancelar el pedido", "#e74c3c");
    } else {
        mostrarNotificacionFlotante("✅ Pedido cancelado correctamente", "#27ae60");
        if (typeof cargarMisPedidos === "function") cargarMisPedidos();
    }
};

// ==========================================
// 17. ESCUDO LEGAL (COOKIES)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('cookies_aceptadas_taller')) {
        const divCookies = document.createElement('div');
        divCookies.id = 'cartel-cookies';
        divCookies.style.cssText = 'position:fixed; bottom:0; left:0; width:100%; background:#2c3e50; color:white; padding:15px 20px; text-align:center; z-index:99999; box-shadow:0 -5px 15px rgba(0,0,0,0.3); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; border-top: 3px solid #e74c3c;';
        
        divCookies.innerHTML = `
            <p style="margin:0; font-size:0.95em; line-height:1.4;">
                <b>¡Aviso de taller! 🛠️</b> Usamos cookies estrictamente necesarias para recordar las piezas de tu cesta y mantener tu garaje seguro. Si sigues navegando, asumimos que te parece bien. 
                <a href="legal.html" style="color:#f1c40f; text-decoration:underline;">Saber más</a>
            </p>
            <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:5px;">
                <button onclick="rechazarCookiesTaller()" style="background:#7f8c8d; color:white; border:none; padding:8px 20px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.95em; transition:0.2s;" onmouseover="this.style.background='#95a5a6'" onmouseout="this.style.background='#7f8c8d'">Rechazar</button>
                <button onclick="aceptarCookiesTaller()" style="background:#27ae60; color:white; border:none; padding:8px 20px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.95em; transition:0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Aceptar Todas</button>
            </div>
        `;
        document.body.appendChild(divCookies);
    }
});

window.aceptarCookiesTaller = () => {
    localStorage.setItem('cookies_aceptadas_taller', 'true');
    const cartel = document.getElementById('cartel-cookies');
    if (cartel) {
        cartel.style.transform = 'translateY(100%)';
        cartel.style.transition = '0.3s';
        setTimeout(() => cartel.remove(), 300);
    }
};
window.rechazarCookiesTaller = () => {
    localStorage.setItem('cookies_aceptadas_taller', 'rechazadas');
    const cartel = document.getElementById('cartel-cookies');
    if (cartel) {
        cartel.style.transform = 'translateY(100%)';
        cartel.style.transition = '0.3s';
        setTimeout(() => cartel.remove(), 300);
    }
};

// ==========================================
// 18. SUBIR PIEZAS AL CATÁLOGO (MODO ADMIN)
// ==========================================
window.enviarPiezaNube = async function() {
    const titulo = document.getElementById('nueva-titulo').value.trim();
    const referencia = document.getElementById('nueva-referencia').value.trim();
    const marca = document.getElementById('nueva-marca').value.trim();
    const coche = document.getElementById('nueva-coche').value.trim();
    const precio = document.getElementById('nueva-precio').value.trim();
    const precio_antiguo = document.getElementById('nueva-precio-antiguo').value.trim(); 
    const estado = document.getElementById('nueva-estado').value;
    const stock = parseInt(document.getElementById('nueva-stock').value) || 1;
    const foto = document.getElementById('nueva-foto').value.trim();
    const galeria = document.getElementById('nueva-galeria').value.trim(); 
    const destacado = document.getElementById('nueva-destacado').checked; 

    if (!titulo || !referencia || !precio) {
        return mostrarNotificacionFlotante("⚠️ Título, Referencia y Precio son obligatorios.", "orange");
    }

    const btn = document.getElementById('btn-subir-bd');
    const txtO = btn.innerText;
    btn.innerText = "Subiendo... ⏳";
    btn.disabled = true;

    const { error } = await clienteSupabase.from('productos').insert([{
        titulo: titulo,
        referencia: referencia,
        marca: marca,
        compatible_con: coche,
        precio: precio,
        precio_antiguo: precio_antiguo || null,
        estado: estado,
        stock: stock,
        foto_url: foto || 'https://via.placeholder.com/300?text=Sin+Foto',
        galeria: galeria || null,
        destacado: destacado, 
        seccion: 'varios', 
        filtro: 'general'
    }]);

    btn.innerText = txtO;
    btn.disabled = false;

    if (error) {
        console.error(error);
        mostrarNotificacionFlotante("❌ Error al subir: La referencia podría estar repetida o faltan columnas.", "#e74c3c");
    } else {
        mostrarNotificacionFlotante("✅ ¡Pieza subida al catálogo con éxito!", "#27ae60");
        
        document.getElementById('nueva-titulo').value = '';
        document.getElementById('nueva-referencia').value = '';
        document.getElementById('nueva-foto').value = '';
        document.getElementById('nueva-precio-antiguo').value = '';
        document.getElementById('nueva-galeria').value = '';
        document.getElementById('nueva-destacado').checked = false;
        
        cargarPiezasDesdeLaNube(); 
    }
};
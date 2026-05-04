// ==========================================
// 1. CONEXIÓN AL SERVIDOR SUPABASE (NUBE)
// ==========================================
const supabaseUrl = 'https://zfhhlqyxekrkczawzgsd.supabase.co';
// Usamos tu clave publishable (¡Segura para la web!)
const supabaseKey = 'sb_publishable_8mz5NZDUm7u_W95s3JKzoQ_EAVEKpVg'; 

// SESIÓN PERSISTENTE ACTIVADA (Nivel Pro)
const clienteSupabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true }
});

let inventarioNube = [];
let rutaActual = 'inicio';
let filtroActual = 'todos';
let busquedaActual = ''; 
let cocheActual = ''; // NUEVO: MEMORIA DEL COCHE DEL GARAJE
let criterioOrden = 'nuevo';

// MEMORIA DE USUARIO, FAVORITOS Y CARRITO
let sessionActiva = false;
let usuarioId = null;
let favoritosNube = []; 
let carrito = JSON.parse(localStorage.getItem('mi_carrito')) || []; 

let paginaActual = 1;
const PIEZAS_POR_PAGINA = 12;

// ESTO EVITA LA PANTALLA EN BLANCO: El semáforo de carga
let cargandoInventario = true; 

// Variable global para evitar el doble arranque (Ponla justo encima de la función)
let descargandoPiezas = false;

// ==========================================
// 2. DESCARGA SEGURA (SISTEMA ANTI-AHOGO)
// ==========================================
async function cargarPiezasDesdeLaNube() {
    // Si ya estamos descargando, frenamos en seco esta segunda orden fantasma
    if (descargandoPiezas) {
        console.log("✋ Freno: Ya estamos descargando, ignorando el doble arranque.");
        return; 
    }
    
    descargandoPiezas = true; // Echamos el cerrojo
    cargandoInventario = true;
    console.log("🏁 1. Iniciando carga de piezas...");
    renderizarVista(); 
    
    try {
        console.log("📡 2. Pidiendo piezas a Supabase...");
        const { data, error } = await clienteSupabase.from('productos').select('*');
        
        if (error) { 
            console.error("❌ ERROR de Supabase:", error); 
            cargandoInventario = false;
            const contenedor = document.getElementById('almacen-piezas');
            if (contenedor) contenedor.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; background:#fff5f5; border-radius:10px; border:1px solid #ffcccc;"><h3 style="color:#e74c3c;">🚨 Error de conexión</h3><p>${error.message}</p></div>`;
            return; 
        }
        
        console.log("✅ 3. Piezas recibidas correctamente.");
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
        console.error("💣 FALLO CRÍTICO EN EL CÓDIGO:", err);
        cargandoInventario = false;
    } finally {
        // MUY IMPORTANTE: Pase lo que pase, al terminar quitamos el cerrojo
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
    let html = `<button class="btn-marca-filtro activo" onclick="filtrarMarca(this, 'todas')" style="padding:6px 12px; background:#2c3e50; color:white; border:none; border-radius:4px; cursor:pointer; font-size:0.85em;">Todas</button>`;
    marcas.forEach(m => html += `<button class="btn-marca-filtro" onclick="filtrarMarca(this, '${m}')" style="padding:6px 12px; background:#f0f0f0; color:#333; border:1px solid #ccc; border-radius:4px; cursor:pointer; font-size:0.85em;">${m}</button>`);
    contenedor.innerHTML = html;
}

window.filtrarMarca = (btn, marca) => {
    document.querySelectorAll('.btn-marca-filtro').forEach(b => { b.style.background = '#f0f0f0'; b.style.color = '#333'; });
    if(btn) { btn.style.background = '#2c3e50'; btn.style.color = 'white'; }
    busquedaActual = marca === 'todas' ? '' : marca;
    document.getElementById('input-busqueda').value = busquedaActual;
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
    
    // NUEVO: LA ETIQUETA CHIP DEL COCHE DEL GARAJE
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
    // NUEVO: PARA BORRAR EL CHIP DEL COCHE
    if (tipo === 'coche') {
        cocheActual = ''; 
        const selectGaraje = document.getElementById('filtro-garaje');
        if (selectGaraje) selectGaraje.value = ''; 
    }
    renderizarVista();
}

// ==========================================
// 4. EL RENDERIZADOR PRINCIPAL BLINDADO
// ==========================================
function renderizarVista() {
    const contenedor = document.getElementById('almacen-piezas');
    if(!contenedor) return;

    if (cargandoInventario) {
        contenedor.innerHTML = `
            <div style="grid-column: 1 / -1; text-align:center; padding:80px 20px; background:white; border-radius:15px; border:1px solid #eee; box-shadow:0 10px 30px rgba(0,0,0,0.05);">
                <div style="width:50px; height:50px; border:5px solid #f3f3f3; border-top:5px solid #e74c3c; border-radius:50%; animation: girar 1s linear infinite; margin:0 auto 20px;"></div>
                <h3 style="color:#2d3436; margin:0; font-size:1.4em;">Sincronizando almacén...</h3>
                <p style="color:#636e72; margin-top:10px;">Preparando el inventario para tu sesión segura.</p>
                <style>@keyframes girar { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
            </div>`;
        return; 
    }

    if (sessionActiva && rutaActual === 'perfil') {
        if (typeof dibujarPanelPerfil === 'function') {
            dibujarPanelPerfil(contenedor);
        } else {
            contenedor.innerHTML = '<div style="grid-column:1/-1; padding:100px; text-align:center;"><h3>Panel de Usuario en mantenimiento</h3></div>';
        }
        return; 
    }

    const termino = busquedaActual.toLowerCase();
    let misFavoritos = (sessionActiva && Array.isArray(favoritosNube)) ? favoritosNube : [];

    // 4. FILTRADO (AHORA CON EL COCHE DEL GARAJE INCORPORADO)
    let filtradas = inventarioNube.filter(p => {
        if (rutaActual === 'favoritos') return misFavoritos.includes(p.referencia);
        let r = (rutaActual === 'inicio') || (p.seccion === rutaActual);
        let f = (filtroActual === 'todos') || (p.filtro === filtroActual);
        let textoBusqueda = ((p.titulo||'') + (p.marca||'') + (p.referencia||'') + (p.compatible_con||'')).toLowerCase();
        let b = termino === '' || textoBusqueda.includes(termino);
        
        // REGLA DEL COCHE DEL GARAJE:
        let c = cocheActual === '' || (p.compatible_con && p.compatible_con.toLowerCase().includes(cocheActual.toLowerCase()));

        return r && f && b && c;
    });

    filtradas.sort((a, b) => {
        const limpia = (p) => parseFloat(p ? p.toString().replace(/[^\d,-]/g, '').replace(',', '.') : 0);
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
            
        let linkWhatsapp = `https://wa.me/34600000000?text=${encodeURIComponent('¡Hola! He visto en la web esta pieza detallada:\n\n- *Pieza:* ' + (p.titulo||'') + '\n- *Ref:* ' + (p.referencia||'') + '\n\n ¿la tenéis en stock?.')}`;

        let esFavorito = misFavoritos.includes(p.referencia);
        let claseActiva = esFavorito ? 'fav-activo' : '';

        html += `
            <div class="tarjeta-recambio" style="position:relative; background:#fff; border-radius:12px; border:1px solid #eee; overflow:hidden; display:flex; flex-direction:column; transition:0.3s; ${p.destacado ? 'border:2px solid #e1b12c; box-shadow:0 8px 20px rgba(225,177,44,0.15); transform:translateY(-3px);' : 'box-shadow:0 4px 10px rgba(0,0,0,0.03);'}">
                ${p.destacado ? '<div style="position:absolute;top:12px;right:12px;background:#e1b12c;color:white;padding:5px 10px;border-radius:6px;font-size:0.7em;font-weight:800;z-index:10;box-shadow:0 3px 6px rgba(0,0,0,0.15);">⭐ RECOMENDADO</div>' : ''}
                <div onclick="abrirModal('${p.referencia}')" style="cursor:pointer; height:210px; background:#f8f9fa; display:flex; align-items:center; justify-content:center; padding:20px; border-bottom:1px solid #f1f2f6;">
                    <img src="${p.foto_url || 'https://via.placeholder.com/300'}" style="max-width:100%; max-height:100%; object-fit:contain; mix-blend-mode:multiply; transition:transform 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                </div>
                <div style="padding:20px; flex-grow:1; display:flex; flex-direction:column;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <span style="background:${p.estado === 'Nuevo' ? '#e3fcf7' : '#f1f2f6'}; color:${p.estado === 'Nuevo' ? '#00b894' : '#576574'}; padding:4px 8px; border-radius:4px; font-size:0.75em; font-weight:bold;">${p.estado === 'Nuevo' ? 'NUEVO' : 'REVISADO'}</span>
                        <span title="Ref: ${p.referencia}" style="font-size:0.9em; color:#576574; background:#f1f2f6; padding:3px 6px; border-radius:4px; font-family:monospace; font-weight:bold; max-width:130px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:inline-block; vertical-align:bottom;">Ref: ${p.referencia}</span>
                    </div>
                    <h3 onclick="abrirModal('${p.referencia}')" style="cursor:pointer; margin:0 0 8px 0; font-size:1.15em; color:#2d3436; line-height:1.3;">${p.titulo || 'Pieza sin título'}</h3>
                    <p style="margin:0 0 15px 0; font-size:0.85em; color:#636e72;">Marca: <strong style="color:#2d3436;">${p.marca || 'Otras'}</strong></p>
                    ${p.compatible_con ? `<p style="font-size:0.8em; color:#636e72; margin-top:-5px; margin-bottom:15px; background:#f1f2f6; padding:8px; border-radius:6px;">🚗 Válido para: <b style="color:#2d3436;">${p.compatible_con}</b></p>` : ''}
                    <div style="margin-top:auto; padding-top:15px; display:flex; justify-content:space-between; align-items:center;">
                        ${precioHtml}
                        <div class="acciones-tarjeta" style="display:flex; gap:8px;">
                            <button id="btn-fav-${p.referencia}" onclick="toggleFavorito('${p.referencia}', event)" class="btn-icono-accion ${claseActiva}" style="background:#f1f2f6; border:none; width:38px; height:38px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s;" title="Guardar favorito">${esFavorito ? '❤️' : '🤍'}</button>
                            <button onclick="compartirPieza('${p.referencia}', event)" class="btn-icono-accion" style="background:#f1f2f6; border:none; width:38px; height:38px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s;" title="Copiar enlace">🔗</button>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px; margin-top:15px;">
                        <button onclick="añadirAlCarrito('${p.referencia}', event)" class="btn-rojo" style="flex:2; padding:10px;">🛒 Añadir</button>
                        <a href="${linkWhatsapp}" target="_blank" class="btn-rojo" style="flex:1; background:#f1f2f6; color:#2c3e50 !important; box-shadow:none; border:1px solid #ddd; display:flex; align-items:center; justify-content:center; text-decoration:none;" title="Preguntar por WhatsApp">💬</a>
                    </div>
                </div>
            </div>`;
    });
    
    contenedor.innerHTML = html || '<div style="width:100%; text-align:center; padding:60px;"><span style="font-size:3em;">🕵️‍♂️</span><h3 style="color:#636e72; margin-top:10px;">No encontramos piezas con esos filtros</h3></div>';

    actualizarEtiquetasFiltros();
    dibujarPaginacion(totalPaginas); 
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
    let linkWhatsapp = `https://wa.me/34600000000?text=${encodeURIComponent('¡Hola! He visto en la web esta pieza detallada:\n\n- Pieza: ' + (p.titulo||'') + '\n- Referencia: ' + (p.referencia||'') + '\n\nMe gustaría saber si es compatible con mi coche.')}`;

    document.getElementById('modal-contenido-dinamico').innerHTML = `
        <div style="display:flex; flex-wrap:wrap;">
            <div style="flex:1 1 450px; background:#f8f9fa; padding:40px; display:flex; flex-direction:column; align-items:center; border-right:1px solid #eee;">
                <img id="foto-main" src="${fotos[0]}" style="width:100%; height:350px; object-fit:contain; mix-blend-mode:multiply; transition:opacity 0.2s; margin-bottom:25px;">
                ${miniaturasHtml}
            </div>
            <div style="flex:1 1 350px; padding:50px; display:flex; flex-direction:column;">
                <span style="color:#a4b0be; font-weight:bold; font-size:0.9em; font-family:monospace;">REF: ${p.referencia}</span>
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
                    <div><span style="font-size:0.8em; color:#a4b0be; text-transform:uppercase; font-weight:bold; letter-spacing:1px;">Precio Final</span><br><span style="font-size:2.8em; font-weight:900; color:#e74c3c; line-height:1;">${p.precio || 'Consultar'}</span></div>
                    <div style="display:flex; gap:10px;">
                        <button id="btn-fav-modal-${p.referencia}" onclick="toggleFavorito('${p.referencia}', event)" class="btn-icono-accion ${esFav ? 'fav-activo' : ''}" style="background:#f1f2f6; border:none; width:50px; height:50px; border-radius:50%; cursor:pointer; font-size:1.2em;">${esFav ? '❤️' : '🤍'}</button>
                    </div>
                </div>
                <div style="display:flex; gap:10px; margin-top:20px; width:100%;">
                    <button onclick="añadirAlCarrito('${p.referencia}', event); cerrarModal()" class="btn-rojo" style="flex:2; text-align:center; padding:18px 20px; border-radius:8px; font-size:1.1em;">🛒 Añadir al Carrito</button>
                    <a href="${linkWhatsapp}" target="_blank" style="flex:1; background:#f1f2f6; color:#2c3e50; text-align:center; padding:18px; border-radius:8px; text-decoration:none; font-weight:bold; border:1px solid #ddd; display:flex; align-items:center; justify-content:center;">💬 Chat</a>
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
// 7. CARRITO DE COMPRAS & STRIPE 💳
// ==========================================
window.abrirPanelCarrito = () => { document.getElementById('panel-carrito').style.right = '0'; document.getElementById('overlay-carrito').style.display = 'block'; }
window.cerrarPanelCarrito = () => { document.getElementById('panel-carrito').style.right = '-400px'; document.getElementById('overlay-carrito').style.display = 'none'; }

window.añadirAlCarrito = (ref, e) => {
    if(e) e.stopPropagation();
    const p = inventarioNube.find(item => item.referencia === ref);
    if (!p) return;
    carrito.push(p);
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

    if (carrito.length === 0) {
        if(lista) lista.innerHTML = '<div style="text-align:center; padding:40px;"><span style="font-size:3em;">🛒</span><p style="color:#aaa; margin-top:10px;">Tu cesta está vacía...</p></div>';
        contadores.forEach(c => c.style.display = 'none');
        if(totalTxt) totalTxt.innerText = '0.00€';
        return;
    }

    contadores.forEach(c => { c.innerText = carrito.length; c.style.display = 'block'; });

    let html = ''; let sumaTotal = 0;
    carrito.forEach((p, index) => {
        let prec = p.precio ? parseFloat(p.precio.replace(/[^\d,]/g, '').replace(',', '.')) : 0;
        sumaTotal += isNaN(prec) ? 0 : prec;
        html += `<div style="display:flex; align-items:center; gap:15px; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                <img src="${p.foto_url || 'https://via.placeholder.com/50'}" style="width:50px; height:50px; object-fit:contain; background:#f9f9f9; border-radius:5px;">
                <div style="flex-grow:1;"><h4 style="font-size:0.9em; margin:0; color:#2c3e50;">${p.titulo}</h4><span style="color:#e74c3c; font-weight:bold;">${p.precio || '0€'}</span></div>
                <span onclick="eliminarDelCarrito(${index})" style="cursor:pointer; color:#e74c3c; font-weight:bold; font-size:1.5em; background:#fdf2f2; padding:0 10px; border-radius:8px;">&times;</span>
            </div>`;
    });
    if(lista) lista.innerHTML = html;
    if(totalTxt) totalTxt.innerText = sumaTotal.toFixed(2) + '€';
}

window.eliminarDelCarrito = (index) => { 
    carrito.splice(index, 1); 
    localStorage.setItem('mi_carrito', JSON.stringify(carrito)); 
    actualizarInterfazCarrito(); 
}

window.comprobarCheckout = () => {
    if (carrito.length === 0) {
        mostrarNotificacionFlotante("⚠️ No puedes pagar con la cesta vacía", "#e74c3c");
        return;
    }
    if (!sessionActiva) {
        mostrarNotificacionFlotante("🔒 Inicia sesión para tramitar el pago", "#f39c12");
        window.cerrarPanelCarrito(); 
        window.abrirLogin();
    } else { 
        const btnCheckout = document.querySelector('#footer-carrito button');
        const txtOriginal = btnCheckout.innerHTML;
        btnCheckout.innerHTML = "Conectando con Pasarela Segura... 🔒";
        btnCheckout.style.background = "#27ae60";
        btnCheckout.disabled = true;

        setTimeout(() => {
            alert("💳 ESTRUCTURA STRIPE LISTA\n\nAquí el usuario será redirigido automáticamente a la ventana de pago seguro de Stripe para introducir su tarjeta.");
            btnCheckout.innerHTML = txtOriginal;
            btnCheckout.style.background = "#e74c3c";
            btnCheckout.disabled = false;
        }, 2000);
    }
}

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
    const btn = document.getElementById('btn-accion-login'); const txtO = btn.innerText;
    btn.innerText = "Enviando... ✉️"; btn.disabled = true;
    const { error } = await clienteSupabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    error ? mostrarMensajeAuth("❌ " + error.message, "#ff7675") : mostrarMensajeAuth("✅ Revisa tu email para cambiar la clave", "#55efc4");
    btn.innerText = txtO; btn.disabled = false;
}

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
        btn.innerText = (titulo === 'Iniciar Sesión' ? "ENTRAR" : "ARRANCAR MI CUENTA 🏁"); btn.disabled = false;
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

window.cerrarSesionSegura = async () => {
    if(confirm("¿Seguro que quieres cerrar la sesión?")) {
        await clienteSupabase.auth.signOut(); 
        window.location.href = 'index.html';
    }
}
window.abrirPestanaPerfil = (id) => {
    document.querySelectorAll('.contenido-perfil-tab').forEach(t => t.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    mostrarNotificacionFlotante("Cargando datos...", "#34495e");
}

// ==========================================
// 9. EVENTOS GENERALES (ARRANQUE EN LÍNEA RECTA)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    
    actualizarInterfazCarrito();
    console.log("🚀 ARRANCANDO MOTOR LINEAL...");

    const { data: authData, error: authErr } = await clienteSupabase.auth.getSession();
    const session = authData.session;

    if (session) {
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
        await cargarMisCoches();

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

    clienteSupabase.auth.onAuthStateChange((event, nuevaSesion) => {
        if (event === 'SIGNED_IN' && !sessionActiva) {
            window.location.reload();
        } else if (event === 'SIGNED_OUT' && sessionActiva) {
            window.location.reload();
        }
    });

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
        cargarMisCoches(); 
    }
    
    btn.innerText = txtOriginal;
    btn.disabled = false;
};

});

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
        filtroGaraje.innerHTML = '<option value="">🚗 Filtrar piezas para mi coche...</option>';
        coches.forEach(coche => {
            filtroGaraje.innerHTML += `<option value="${coche.modelo}">${coche.modelo}</option>`;
        });
    }
};

// ==========================================
// VENTANAS FLOTANTES (MODALES) PARA EL GARAJE
// ==========================================
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
            if (!error) { mostrarNotificacionFlotante("🚗 Coche eliminado", "#e74c3c"); cargarMisCoches(); }
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
            if (!error) { mostrarNotificacionFlotante("✅ Vehículo actualizado", "#27ae60"); cargarMisCoches(); }
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

// ==========================================
// FUNCIÓN PARA FILTRAR POR COCHE DEL GARAJE
// ==========================================
window.filtrarPorMiCoche = function() {
    const select = document.getElementById('filtro-garaje');
    if(!select) return;
    
    cocheActual = select.value; 
    paginaActual = 1; 
    renderizarVista(); 
};
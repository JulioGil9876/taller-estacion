// ==========================================
// 1. CONEXIÓN AL SERVIDOR SUPABASE (NUBE)
// ==========================================
const supabaseUrl = 'https://zfhhlqyxekrkczawzgsd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmaGhscXl4ZWtya2N6YXd6Z3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTk4ODUsImV4cCI6MjA5MjI5NTg4NX0.Aioc97TxOALEoNKRGOsNxRAY0auoIeMeMzChf9cd-tc'; 
const clienteSupabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let inventarioNube = [];
let rutaActual = 'inicio';
let filtroActual = 'todos';
let busquedaActual = ''; 
let criterioOrden = 'nuevo';

// MEMORIA DE USUARIO, FAVORITOS Y CARRITO
let sessionActiva = false;
let usuarioId = null;
let favoritosNube = []; 
let carrito = [];

let paginaActual = 1;
const PIEZAS_POR_PAGINA = 12;

// ==========================================
// 2. DESCARGA SEGURA
// ==========================================
async function cargarPiezasDesdeLaNube() {
    const contenedor = document.getElementById('almacen-piezas');
    if(contenedor) contenedor.innerHTML = '<h3 style="text-align:center; width:100%; color:#555;">Conectando con el almacén central... ⚙️</h3>';
    
    try {
        const { data, error } = await clienteSupabase.from('productos').select('*');
        if (error) { console.error("Error de Supabase:", error); return; }
        
        inventarioNube = data || [];
        generarFiltrosDeMarca(); 
        generarSubFiltros();
        
        const parametrosUrl = new URLSearchParams(window.location.search);
        const ref = parametrosUrl.get('ref');
        if (ref) {
            const p = inventarioNube.find(item => item.referencia === ref);
            if (p) window.abrirModal(p.referencia);
        }
        
        // Comprueba si venimos buscando los favoritos
        if (parametrosUrl.get('vista') === 'favoritos') {
            setTimeout(() => verFavoritos(), 300);
        } else {
            renderizarVista();
        }

    } catch (err) {  
        console.error("Fallo crítico:", err);
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
    if (busquedaActual !== '') html += `<div class="chip-filtro" onclick="quitarFiltro('busqueda')" title="Quitar este filtro">Marca: ${busquedaActual} ✖</div>`;
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
    renderizarVista();
}

// ==========================================
// 4. EL RENDERIZADOR PRINCIPAL (DISEÑO ANTIGUO + CARRITO)
// ==========================================
function renderizarVista() {
    const contenedor = document.getElementById('almacen-piezas');
    if(!contenedor) return;
    const termino = busquedaActual.toLowerCase();
    
    let misFavoritos = sessionActiva ? favoritosNube : [];

    let filtradas = inventarioNube.filter(p => {
        if (rutaActual === 'favoritos') return misFavoritos.includes(p.referencia);
        let r = (rutaActual === 'inicio') || (p.seccion === rutaActual);
        let f = (filtroActual === 'todos') || (p.filtro === filtroActual);
        // Búsqueda segura
        let textoBusqueda = ((p.titulo||'') + (p.marca||'') + (p.referencia||'') + (p.compatible_con||'')).toLowerCase();
        let b = termino === '' || textoBusqueda.includes(termino);
        return r && f && b;
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
                            <button id="btn-fav-${p.referencia}" onclick="toggleFavorito('${p.referencia}', event)" class="btn-icono-accion ${claseActiva}" style="background:#f1f2f6; border:none; width:38px; height:38px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s;">${esFavorito ? '❤️' : '🤍'}</button>
                            <button onclick="compartirPieza('${p.referencia}', event)" class="btn-icono-accion" style="background:#f1f2f6; border:none; width:38px; height:38px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s;">🔗</button>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px; margin-top:15px;">
                        <button onclick="añadirAlCarrito('${p.referencia}', event)" class="btn-rojo" style="flex:2; padding:10px;">🛒 Añadir</button>
                        <a href="${linkWhatsapp}" target="_blank" class="btn-rojo" style="flex:1; background:#f1f2f6; color:#2c3e50 !important; box-shadow:none; border:1px solid #ddd; display:flex; align-items:center; justify-content:center; text-decoration:none;">💬</a>
                    </div>
                </div>
            </div>`;
    });
    
    contenedor.innerHTML = html || '<h3 style="text-align:center; width:100%; color:#aaa; margin-top:50px;">Aún no hay piezas aquí 🕵️‍♂️</h3>';

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
    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?ref=${ref}`).then(() => mostrarNotificacionFlotante("🔗 Enlace copiado"));
}

window.verFavoritos = async () => {
    if (!document.getElementById('almacen-piezas')) {
        window.location.href = "recambios.html?vista=favoritos";
        return;
    }

    if (!sessionActiva) {
        alert("🔒 ¡Inicia sesión para ver tu lista de piezas guardadas!");
        window.abrirLogin();
        return;
    }

    document.querySelectorAll('.btn-ruta-v').forEach(b => { 
        b.style.background = 'white'; b.style.color = 'black'; b.style.borderColor = '#ddd'; 
        b.classList.remove('activo');
    });

    rutaActual = 'favoritos';
    filtroActual = 'todos';
    paginaActual = 1;
    
    if(document.getElementById('titulo-ruta')) document.getElementById('titulo-ruta').innerText = '❤️ Mis Favoritos';
    if(document.getElementById('bloque-subfiltros')) document.getElementById('bloque-subfiltros').style.display = 'none';
    
    renderizarVista();
};

window.toggleFavorito = async (ref, e) => {
    if(e) e.stopPropagation();
    
    if (!sessionActiva) { 
        alert("🔒 ¡Inicia sesión para guardar favoritos!"); 
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
        mostrarNotificacionFlotante("⭐ Guardado en tus favoritos");
        await clienteSupabase.from('favoritos').insert([{ user_id: usuarioId, producto_ref: ref }]);
    } else {
        favoritosNube.splice(indice, 1);
        if(botonPulsado){ botonPulsado.innerHTML = '🤍'; botonPulsado.classList.remove('fav-activo'); }
        if(btnM){ btnM.innerHTML = '🤍'; btnM.classList.remove('fav-activo'); }
        mostrarNotificacionFlotante("🗑️ Eliminado de favoritos");
        if(rutaActual === 'favoritos') renderizarVista();
        await clienteSupabase.from('favoritos').delete().eq('user_id', usuarioId).eq('producto_ref', ref);
    }
}

function mostrarNotificacionFlotante(mensaje) {
    const vieja = document.getElementById('notificacion-flotante');
    if (vieja) vieja.remove();
    const toast = document.createElement('div');
    toast.id = 'notificacion-flotante';
    toast.innerText = mensaje;
    toast.style.cssText = 'position:fixed; bottom:30px; right:30px; background:#2c3e50; color:white; padding:12px 24px; border-radius:10px; box-shadow:0 10px 25px rgba(0,0,0,0.2); z-index:9999; font-weight:bold; transform:translateY(100px); opacity:0; transition:all 0.3s ease;';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; }, 10);
    setTimeout(() => { toast.style.transform = 'translateY(20px)'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
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
// 7. CARRITO DE COMPRAS
// ==========================================
window.abrirPanelCarrito = () => { document.getElementById('panel-carrito').style.right = '0'; document.getElementById('overlay-carrito').style.display = 'block'; }
window.cerrarPanelCarrito = () => { document.getElementById('panel-carrito').style.right = '-400px'; document.getElementById('overlay-carrito').style.display = 'none'; }

window.añadirAlCarrito = (ref, e) => {
    if(e) e.stopPropagation();
    const p = inventarioNube.find(item => item.referencia === ref);
    if (!p) return;
    carrito.push(p);
    actualizarInterfazCarrito();
    const cont = document.getElementById('contenedor-carrito-nav');
    if(cont) { cont.style.transform = 'scale(1.3)'; setTimeout(() => cont.style.transform = 'scale(1)', 200); }
    mostrarNotificacionFlotante("🛒 Añadido a la cesta");
}

function actualizarInterfazCarrito() {
    const lista = document.getElementById('lista-carrito');
    const contadores = document.querySelectorAll('#contador-carrito');
    const totalTxt = document.getElementById('total-precio-carrito');

    if (carrito.length === 0) {
        if(lista) lista.innerHTML = '<p style="text-align: center; color: #aaa; margin-top: 50px;">Tu cesta está vacía...</p>';
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
                <span onclick="eliminarDelCarrito(${index})" style="cursor:pointer; color:#aaa; font-weight:bold; font-size:1.5em;">&times;</span>
            </div>`;
    });
    if(lista) lista.innerHTML = html;
    if(totalTxt) totalTxt.innerText = sumaTotal.toFixed(2) + '€';
}

window.eliminarDelCarrito = (index) => { carrito.splice(index, 1); actualizarInterfazCarrito(); }

window.comprobarCheckout = () => {
    if (carrito.length === 0) return alert("⚠️ La cesta está vacía.");
    if (!sessionActiva) {
        alert("🔒 Inicia sesión o crea una cuenta para tramitar tu pedido.");
        window.cerrarPanelCarrito(); window.abrirLogin();
    } else { alert("💳 ¡Genial! Preparando pasarela de pago (Stripe)..."); }
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

document.addEventListener('DOMContentLoaded', () => {
    const inputPass = document.getElementById('pass-login');
    if(inputPass) {
        inputPass.addEventListener('input', (e) => {
            const pass = e.target.value; const tieneLong = pass.length >= 6; const tieneNum = /\d/.test(pass);
            const rLon = document.getElementById('regla-longitud'); const rNum = document.getElementById('regla-numero');
            if(rLon) { rLon.innerHTML = tieneLong ? '✅ Mínimo 6 caracteres' : '❌ Mínimo 6 caracteres'; rLon.style.color = tieneLong ? '#27ae60' : '#e74c3c'; }
            if(rNum) { rNum.innerHTML = tieneNum ? '✅ Debe contener un número' : '❌ Debe contener un número'; rNum.style.color = tieneNum ? '#27ae60' : '#e74c3c'; }
        });
    }
});

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
        mostrarMensajeAuth(titulo === 'Iniciar Sesión' ? "¡Hola de nuevo! 👋" : "¡Bienvenida/o! 🌟", "#55efc4");
        setTimeout(() => { cerrarLogin(); btn.disabled = false; }, 1500);
    }
}

function mostrarMensajeAuth(texto, color) {
    const div = document.getElementById('mensaje-auth');
    if(div) { div.innerText = texto; div.style.display = 'block'; div.style.backgroundColor = color + "22"; div.style.color = color; }
}

window.cerrarSesion = async () => { await clienteSupabase.auth.signOut(); location.reload(); }

// ==========================================
// 9. EVENTOS GENERALES (EL CEREBRO CENTRAL)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // Escucha de sesión de Supabase
    clienteSupabase.auth.onAuthStateChange(async (event, session) => {
        const btnU = document.querySelectorAll('#btn-usuario-nav'); 
        if (session) {
            sessionActiva = true; usuarioId = session.user.id;
            const { data } = await clienteSupabase.from('favoritos').select('producto_ref').eq('user_id', usuarioId);
            if (data) favoritosNube = data.map(f => f.producto_ref);
            btnU.forEach(btn => {
                btn.innerHTML = `✅ ${session.user.email.split('@')[0].toUpperCase()} <span style="font-size:0.8em; opacity:0.6;">(Salir)</span>`;
                btn.onclick = cerrarSesion; btn.style.color = "#27ae60"; btn.style.borderColor = "#27ae60";
            });
            renderizarVista();
        } else {
            sessionActiva = false; usuarioId = null; favoritosNube = [];
            btnU.forEach(btn => {
                btn.innerHTML = "👤 Mi Cuenta"; btn.onclick = abrirLogin; btn.style.color = "#1a252f"; btn.style.borderColor = "#1a252f";
            });
            renderizarVista();
        }
    });

    // Cargar piezas
    cargarPiezasDesdeLaNube();

    // Filtros de móvil
    const btnFiltros = document.getElementById('btn-toggle-filtros');
    const sidebar = document.querySelector('.sidebar-filtros');
    if (btnFiltros && sidebar) {
        btnFiltros.addEventListener('click', () => {
            sidebar.classList.toggle('abierta');
            if (sidebar.classList.contains('abierta')) { btnFiltros.innerHTML = '❌ Ocultar Filtros'; btnFiltros.style.background = '#e74c3c'; } 
            else { btnFiltros.innerHTML = '⚙️ Mostrar Filtros'; btnFiltros.style.background = '#2c3e50'; }
        });
    }

    // Rutas (Menú lateral)
    document.querySelectorAll('.btn-ruta-v').forEach(boton => {
        boton.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-ruta-v').forEach(b => { b.style.background = 'white'; b.style.color = 'black'; b.style.borderColor = '#ddd'; });
            
            rutaActual = e.target.getAttribute('data-ruta');
            
            if(rutaActual === 'favoritos') {
                e.target.style.background = '#fffbe8'; e.target.style.color = '#d6a200'; e.target.style.borderColor = '#ffd32a';
                if(document.getElementById('titulo-ruta')) document.getElementById('titulo-ruta').innerText = '⭐ Mis Favoritos';
                if(!sessionActiva) { alert("⚠️ Inicia sesión para ver tus piezas guardadas."); abrirLogin(); }
            } else {
                e.target.style.background = '#e74c3c'; e.target.style.color = 'white'; e.target.style.borderColor = '#e74c3c';
                if(document.getElementById('titulo-ruta')) document.getElementById('titulo-ruta').innerText = rutaActual === 'inicio' ? 'Catálogo General' : 'Sección: ' + rutaActual.charAt(0).toUpperCase() + rutaActual.slice(1);
                generarSubFiltros(); 
            }
            
            filtroActual = 'todos'; paginaActual = 1; renderizarVista();
        });
    });

    const inputB = document.getElementById('input-busqueda');
    if (inputB) inputB.addEventListener('input', (e) => { busquedaActual = e.target.value; paginaActual = 1; document.querySelectorAll('.btn-marca-filtro').forEach(b => { b.style.background = '#f0f0f0'; b.style.color = '#333'; }); renderizarVista(); });

    const selectorO = document.getElementById('ordenar-por');
    if (selectorO) selectorO.addEventListener('change', (e) => { criterioOrden = e.target.value; paginaActual = 1; renderizarVista(); });
});
document.addEventListener('DOMContentLoaded', () => {

    // ==========================================================================
    // 1. REFERENCIAS AL DOM
    // ==========================================================================
    const pantallas = {
        login: document.getElementById('pantalla-login'),
        registro: document.getElementById('pantalla-registro'),
        olvido: document.getElementById('pantalla-olvido'),
        formulario: document.getElementById('pantalla-formulario'),
        calendario: document.getElementById('pantalla-calendario'),
        adminPrincipal: document.getElementById('pantalla-admin-principal'),
        adminDetalle: document.getElementById('pantalla-admin-detalle')
    };

    const overlay = document.getElementById('overlay-global');
    const menuUsuario = document.getElementById('menu-lateral-usuario');
    const menuAdmin = document.getElementById('menu-lateral-admin');
    const modalPerfil = document.getElementById('modal-perfil');
    const modalConfig = document.getElementById('modal-configuracion');

    const panelEventos = document.querySelector('.panel-eventos');
    const btnCerrarPanelMovil = document.querySelector('.btn-cerrar-modal');

    // ==========================================================================
    // 2. SISTEMA DE NAVEGACIÓN (SPA) Y MODALES
    // ==========================================================================
    function navegarA(idDestino) {
        Object.values(pantallas).forEach(pantalla => {
            if (pantalla) {
                pantalla.classList.add('oculto');
                pantalla.classList.remove('fade-in-activo');
            }
        });

        const destino = pantallas[idDestino];
        if (destino) {
            destino.classList.remove('oculto');
            setTimeout(() => destino.classList.add('fade-in-activo'), 10);
        }
        cerrarTodo();
    }

    function abrirElemento(elemento) {
        overlay.classList.remove('oculto');
        elemento.classList.remove('oculto');
        setTimeout(() => elemento.classList.add('fade-in-activo'), 10);
    }

    function cerrarTodo() {
        overlay.classList.add('oculto');
        [menuUsuario, menuAdmin, modalPerfil, modalConfig].forEach(el => {
            if (el) {
                el.classList.add('oculto');
                el.classList.remove('fade-in-activo');
            }
        });
        if (panelEventos) {
            panelEventos.classList.remove('modal-activo-movil');
        }
    }

    // Cierra modales si tocas el fondo oscuro
    overlay?.addEventListener('click', cerrarTodo);

    // Cierra SOLAMENTE el panel de eventos en el móvil usando la X
    btnCerrarPanelMovil?.addEventListener('click', () => {
        if (panelEventos) {
            panelEventos.classList.remove('modal-activo-movil');
        }
    });

    // ==========================================================================
    // 3. VALIDACIÓN DE FORMULARIOS
    // ==========================================================================
    function validarFormulario(formulario) {
        let esValido = true;
        const inputs = formulario.querySelectorAll('input[required], textarea[required]');
        formulario.querySelectorAll('.mensaje-error').forEach(msg => msg.remove());

        inputs.forEach(input => {
            if (!input.value.trim()) {
                esValido = false;
                input.style.borderColor = '#FF0000';
                const error = document.createElement('span');
                error.className = 'mensaje-error';
                error.style.color = '#FF0000';
                error.style.fontSize = '0.9rem';
                error.style.display = 'block';
                error.style.marginBottom = '1rem';
                error.innerText = 'Este campo es obligatorio.';
                input.parentNode.insertBefore(error, input.nextSibling);
            } else {
                input.style.borderColor = '';
            }
        });
        return esValido;
    }

    // ==========================================================================
    // 4. LÓGICA DEL CALENDARIO DINÁMICO (CRUD)
    // ==========================================================================
    let fechaActual = new Date();
    let diaSeleccionadoStr = null;
    let indiceEventoSeleccionado = null;

    const memoriaEventos = {};
    const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    const contenedorDias = document.getElementById('contenedor-dias-mes');
    const textoMesActual = document.getElementById('mes-actual-texto');
    const textoDiaSeleccionado = document.getElementById('texto-dia-seleccionado') || document.querySelector('.dia-seleccionado');
    const desplegableEventos = document.querySelector('.btn-desplegable');

    function formatearFecha(anio, mes, dia) {
        return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }

    function renderizarCalendario() {
        if (!contenedorDias) return;

        const anio = fechaActual.getFullYear();
        const mes = fechaActual.getMonth();
        
        textoMesActual.innerText = `${mesesNombres[mes]} ${anio}`;
        contenedorDias.innerHTML = '';

        const primerDiaMes = new Date(anio, mes, 1);
        const diasEnMes = new Date(anio, mes + 1, 0).getDate();
        
        let diaSemanaInicio = primerDiaMes.getDay();
        // Ajustamos para que la semana empiece en Lunes
        diaSemanaInicio = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1;

        // 1. Inyectamos las casillas grises vacías AL PRINCIPIO del mes
        for (let i = 0; i < diaSemanaInicio; i++) {
            const divVacio = document.createElement('div');
            divVacio.className = 'dia dia-vacio';
            contenedorDias.appendChild(divVacio);
        }

        // 2. Inyectamos los días reales del mes
        for (let dia = 1; dia <= diasEnMes; dia++) {
            const divDia = document.createElement('div');
            divDia.className = 'dia';
            divDia.innerText = dia;
            
            const fechaStr = formatearFecha(anio, mes, dia);
            divDia.dataset.fecha = fechaStr;

            if (fechaStr === diaSeleccionadoStr) {
                divDia.classList.add('seleccionado');
            }

            if (memoriaEventos[fechaStr]) {
                memoriaEventos[fechaStr].forEach(evento => {
                    const miniatura = document.createElement('span');
                    miniatura.className = 'evento-miniatura';
                    miniatura.innerText = evento.nombre;
                    divDia.appendChild(miniatura);
                });
            }

            divDia.addEventListener('click', () => seleccionarDia(fechaStr, divDia, dia, mes));
            contenedorDias.appendChild(divDia);
        }

        // 3. Calculamos cuántas casillas faltan para cerrar la última fila
        const celdasTotales = diaSemanaInicio + diasEnMes;
        const celdasFaltantes = (7 - (celdasTotales % 7)) % 7;

        // Inyectamos las casillas grises vacías AL FINAL del mes
        for (let i = 0; i < celdasFaltantes; i++) {
            const divVacioFinal = document.createElement('div');
            divVacioFinal.className = 'dia dia-vacio';
            contenedorDias.appendChild(divVacioFinal);
        }
    }

    function seleccionarDia(fechaStr, elementoDia, dia, mes) {
        diaSeleccionadoStr = fechaStr;
        indiceEventoSeleccionado = null;
        document.getElementById('form-evento').reset();

        document.querySelectorAll('.dia').forEach(d => d.classList.remove('seleccionado'));
        elementoDia.classList.add('seleccionado');

        if (textoDiaSeleccionado) {
            textoDiaSeleccionado.innerText = `${dia} de ${mesesNombres[mes]}`;
        }

        cargarEventosEnDesplegable(fechaStr);

        // Abre el panel en móviles sin activar la pantalla oscura
        if (window.innerWidth <= 768 && panelEventos) {
            panelEventos.classList.add('modal-activo-movil');
        }
    }

    function cargarEventosEnDesplegable(fechaStr) {
        if (!desplegableEventos) return;

        desplegableEventos.innerHTML = '';
        const eventosDelDia = memoriaEventos[fechaStr];

        const opcionNuevo = document.createElement('option');
        opcionNuevo.innerText = (eventosDelDia && eventosDelDia.length > 0) ? "+ Crear nuevo evento" : "Aún no hay eventos";
        opcionNuevo.value = "";
        desplegableEventos.appendChild(opcionNuevo);

        if (eventosDelDia && eventosDelDia.length > 0) {
            eventosDelDia.forEach((evento, index) => {
                const opcion = document.createElement('option');
                opcion.innerText = `${evento.inicio} - ${evento.nombre}`;
                opcion.value = index;
                desplegableEventos.appendChild(opcion);
            });
        }
    }

    desplegableEventos?.addEventListener('change', (e) => {
        const valor = e.target.value;
        if (valor === "") {
            indiceEventoSeleccionado = null;
            document.getElementById('form-evento').reset();
        } else {
            indiceEventoSeleccionado = parseInt(valor);
            const evento = memoriaEventos[diaSeleccionadoStr][indiceEventoSeleccionado];

            document.getElementById('ev-nombre').value = evento.nombre;
            document.getElementById('ev-inicio').value = evento.inicio;
            document.getElementById('ev-fin').value = evento.fin;
            document.getElementById('ev-desc').value = evento.desc;

            const radioCategoria = document.querySelector(`input[name="ev-cat"][value="${evento.categoria}"]`);
            if (radioCategoria) radioCategoria.checked = true;

            const rangePrioridad = document.getElementById('ev-prio');
            if (rangePrioridad) rangePrioridad.value = evento.prioridad;
        }
    });

    document.getElementById('btn-mes-anterior')?.addEventListener('click', () => {
        fechaActual.setMonth(fechaActual.getMonth() - 1);
        renderizarCalendario();
    });

    document.getElementById('btn-mes-siguiente')?.addEventListener('click', () => {
        fechaActual.setMonth(fechaActual.getMonth() + 1);
        renderizarCalendario();
    });

    // Guardar Evento y Ordenar por Hora
    document.getElementById('form-evento')?.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!diaSeleccionadoStr) {
            alert("Por favor, selecciona un día en el calendario primero.");
            return;
        }

        // Recolección de datos
        const nombre = document.getElementById('ev-nombre').value;
        const inicio = document.getElementById('ev-inicio').value;
        const fin = document.getElementById('ev-fin').value;
        const desc = document.getElementById('ev-desc').value;
        const catElement = document.querySelector('input[name="ev-cat"]:checked');
        const categoria = catElement ? catElement.value : 'estudio';
        const prioElement = document.getElementById('ev-prio');
        const prioridad = prioElement ? prioElement.value : '5';
        
        const datosEvento = { nombre, inicio, fin, desc, categoria, prioridad };

        // Aseguramos que exista el día en la memoria
        if (!memoriaEventos[diaSeleccionadoStr]) {
            memoriaEventos[diaSeleccionadoStr] = [];
        }

        // Guardamos o actualizamos
        if (indiceEventoSeleccionado !== null) {
            memoriaEventos[diaSeleccionadoStr][indiceEventoSeleccionado] = datosEvento;
        } else {
            memoriaEventos[diaSeleccionadoStr].push(datosEvento);
        }
        
        // Ordenamos todos los eventos de ese día de menor a mayor hora
        memoriaEventos[diaSeleccionadoStr].sort((a, b) => {
            return a.inicio.localeCompare(b.inicio);
        });
        
        // Limpiamos la interfaz
        e.target.reset(); 
        indiceEventoSeleccionado = null; 
        
        // Refrescamos las vistas
        renderizarCalendario();
        cargarEventosEnDesplegable(diaSeleccionadoStr);
        
        // Lógica móvil: cerramos el panel
        if (window.innerWidth <= 768 && panelEventos) {
            panelEventos.classList.remove('modal-activo-movil');
            const overlayGlobal = document.getElementById('overlay-global');
            if(overlayGlobal) overlayGlobal.classList.add('oculto');
        }
    });

    document.querySelector('.btn-borrar')?.addEventListener('click', () => {
        if (indiceEventoSeleccionado !== null && diaSeleccionadoStr) {
            if (confirm("¿Estás seguro de que deseas eliminar este evento?")) {
                memoriaEventos[diaSeleccionadoStr].splice(indiceEventoSeleccionado, 1);
                document.getElementById('form-evento').reset();
                indiceEventoSeleccionado = null;

                renderizarCalendario();
                cargarEventosEnDesplegable(diaSeleccionadoStr);

                if (window.innerWidth <= 768 && panelEventos) {
                    panelEventos.classList.remove('modal-activo-movil');
                }
            }
        } else {
            alert("Selecciona un evento del menú desplegable para poder borrarlo.");
        }
    });

    renderizarCalendario();

    // ==========================================================================
    // 5. ASIGNACIÓN DE EVENTOS GENERALES (ROUTING)
    // ==========================================================================
    document.getElementById('btn-ir-registro')?.addEventListener('click', () => navegarA('registro'));
    document.getElementById('btn-volver-login-reg')?.addEventListener('click', () => navegarA('login'));
    document.getElementById('btn-ir-olvido')?.addEventListener('click', () => navegarA('olvido'));
    document.getElementById('btn-volver-login-olv')?.addEventListener('click', () => navegarA('login'));

    document.getElementById('form-login')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (validarFormulario(e.target)) {
            const correo = document.getElementById('correo-login').value;
            const password = document.getElementById('pass-login').value;

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo, password })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('usuario', JSON.stringify(data.usuario));
                    if (data.usuario.rol === 'admin') {
                        navegarA('adminPrincipal');
                    } else {
                        navegarA('calendario');
                        renderizarCalendario();
                    }
                } else {
                    alert(data.error || 'Error al iniciar sesión');
                }
            } catch (error) {
                console.error("Error:", error);
                alert("Error de conexión con el servidor.");
            }
        }
    });

    document.getElementById('form-registro')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (validarFormulario(e.target)) {
            const nombre = document.getElementById('reg-nombre').value;
            const apellidos = document.getElementById('reg-apellidos').value;
            const correo = document.getElementById('reg-correo').value;
            const password = document.getElementById('reg-pass').value;

            try {
                const response = await fetch('/api/auth/registro', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre, apellidos, correo, password })
                });

                const data = await response.json();

                if (response.ok) {
                    // Guardar ID temporalmente para el siguiente paso
                    localStorage.setItem('tempUsuarioId', data.usuarioId);
                    navegarA('formulario');
                } else {
                    alert(data.error || 'Error en el registro');
                }
            } catch (error) {
                console.error("Error:", error);
                alert("Error de conexión con el servidor.");
            }
        }
    });

    document.getElementById('form-olvido')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (validarFormulario(e.target)) navegarA('login');
    });

    document.getElementById('form-preferencias')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (validarFormulario(e.target)) {
            const tempUsuarioId = localStorage.getItem('tempUsuarioId');
            
            if (!tempUsuarioId) {
                alert("Error de sesión. Por favor, inicie sesión de nuevo.");
                navegarA('login');
                return;
            }

            const preferencias = {
                horarioInicio: document.getElementById('pref-h-inicio').value,
                horarioFin: document.getElementById('pref-h-fin').value,
                horarioFijoInicio: document.getElementById('pref-h-fijo-inicio').value,
                horarioFijoFin: document.getElementById('pref-h-fijo-fin').value,
                horasOcio: document.getElementById('pref-ocio').value,
                energia: document.querySelector('input[name="energia"]:checked')?.value,
                concentracion: document.getElementById('pref-concentracion').value,
                estres: document.getElementById('pref-estres').value,
                actividadesExtra: document.getElementById('pref-extra').value,
                asignaturasDificiles: document.getElementById('pref-dificiles').value,
                finesSemanaLibres: document.querySelector('input[name="findes"]:checked')?.value === 'si',
                multiplesAsignaturas: document.querySelector('input[name="multiples"]:checked')?.value === 'varias'
            };

            try {
                const response = await fetch(`/api/usuarios/${tempUsuarioId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ preferencias })
                });

                if (response.ok) {
                    // Limpiar el ID temporal y obligar a iniciar sesión para cargar todo completo
                    localStorage.removeItem('tempUsuarioId');
                    alert("¡Preferencias guardadas! Ahora por favor inicia sesión.");
                    navegarA('login');
                } else {
                    alert('Error al guardar las preferencias');
                }
            } catch (error) {
                console.error("Error:", error);
                alert("Error de conexión con el servidor.");
            }
        }
    });

    document.getElementById('btn-menu-usuario')?.addEventListener('click', () => abrirElemento(menuUsuario));
    document.getElementById('abrir-perfil')?.addEventListener('click', () => { menuUsuario.classList.add('oculto'); abrirElemento(modalPerfil); });
    document.getElementById('abrir-config')?.addEventListener('click', () => { menuUsuario.classList.add('oculto'); abrirElemento(modalConfig); });
    document.getElementById('cerrar-sesion')?.addEventListener('click', () => {
        localStorage.removeItem('usuario');
        navegarA('login');
    });
    document.getElementById('btn-ir-preferencias')?.addEventListener('click', () => { cerrarTodo(); navegarA('formulario'); });

    document.querySelectorAll('.btn-abrir-menu-admin').forEach(btn => {
        btn.addEventListener('click', () => abrirElemento(menuAdmin));
    });

    document.getElementById('abrir-config-admin')?.addEventListener('click', () => { menuAdmin.classList.add('oculto'); abrirElemento(modalConfig); });
    document.getElementById('cerrar-sesion-admin')?.addEventListener('click', () => {
        localStorage.removeItem('usuario');
        navegarA('login');
    });

    const tarjetasUsuario = document.querySelectorAll('.tarjeta-usuario');
    tarjetasUsuario.forEach(tarjeta => {
        tarjeta.addEventListener('click', () => navegarA('adminDetalle'));
    });

    const buscador = document.getElementById('buscador-usuarios');
    if (buscador) {
        buscador.addEventListener('keyup', (e) => {
            const termino = e.target.value.toLowerCase();
            tarjetasUsuario.forEach(tarjeta => {
                const nombre = tarjeta.querySelector('.nombre-usuario').innerText.toLowerCase();
                if (nombre.includes(termino)) {
                    tarjeta.style.display = 'flex';
                } else {
                    tarjeta.style.display = 'none';
                }
            });
        });
    }

    // ==========================================================================
    // 6. LÓGICA DE ÁREAS DE TEXTO ADMIN (PUBLICACIÓN)
    // ==========================================================================
    const inputMensaje = document.getElementById('input-nuevo-mensaje');
    const btnGuardarMensaje = document.getElementById('btn-guardar-mensaje');
    const logMensajes = document.getElementById('log-mensajes');

    const inputAlerta = document.getElementById('input-nueva-alerta');
    const btnGuardarAlerta = document.getElementById('btn-guardar-alerta');
    const logAlertas = document.getElementById('log-alertas');

    function configurarTextareaAdmin(input, btn, log) {
        if (!input || !btn || !log) return;

        input.addEventListener('input', () => {
            if (input.value.trim() !== '') {
                btn.classList.remove('oculto'); 
            } else {
                btn.classList.add('oculto'); 
            }
        });

        btn.addEventListener('click', () => {
            const texto = input.value.trim();
            if (texto) {
                const nuevoItem = document.createElement('div');
                nuevoItem.className = 'item-log fade-in-activo';
                nuevoItem.innerText = texto;

                log.prepend(nuevoItem);

                input.value = '';
                btn.classList.add('oculto');
            }
        });
    }

    configurarTextareaAdmin(inputMensaje, btnGuardarMensaje, logMensajes);
    configurarTextareaAdmin(inputAlerta, btnGuardarAlerta, logAlertas);

    // ==========================================================================
    // 7. LÓGICA DE BANEO DE USUARIOS
    // ==========================================================================
    const btnBanear = document.getElementById('btn-banear-usuario');
    
    if (btnBanear) {
        btnBanear.addEventListener('click', () => {
            const confirmacion = confirm("¿Estás absolutamente seguro de que deseas banear a este usuario? Esta acción le impedirá acceder a StudyCo.");
            
            if (confirmacion) {
                alert("El usuario ha sido baneado del sistema.");
                navegarA('adminPrincipal');
            }
        });
    }
});
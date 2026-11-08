const archivosInput = document.getElementById("archivos");
const nombreArchivos = document.getElementById("nombre-archivos");
const btnSubir = document.getElementById("btn-subir");

// URL DE GOOGLE APPS SCRIPT

const URL_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbzlQ-41KXv-IXFPoT1PT-tLz38onx5es51ttqUWGo3PjmxBACPy9TKVxdMpmH0rbuur/exec";

const DURACION_MAXIMA = 30;

// =====================================
// MOSTRAR ARCHIVOS SELECCIONADOS
// =====================================

archivosInput.addEventListener("change", function () {

    const archivos = Array.from(archivosInput.files);

    if (archivos.length === 0) {

        nombreArchivos.textContent =
            "No has seleccionado ningún archivo.";

        return;
    }

    let fotos = 0;
    let videos = 0;
    let tamañoTotal = 0;

    for (const archivo of archivos) {

        tamañoTotal += archivo.size;

        if (archivo.type.startsWith("image/")) {

            fotos++;

        } else if (archivo.type.startsWith("video/")) {

            videos++;

        }

    }

    const tamañoMB =
        (tamañoTotal / (1024 * 1024)).toFixed(2);

    let mensaje = "";

    if (fotos > 0) {

        mensaje +=
            `📸 ${fotos} foto${fotos !== 1 ? "s" : ""}`;

    }

    if (videos > 0) {

        if (mensaje !== "") mensaje += " • ";

        mensaje +=
            `🎥 ${videos} vídeo${videos !== 1 ? "s" : ""}`;

    }

    nombreArchivos.innerHTML =
        mensaje + `<br>📦 Tamaño total: ${tamañoMB} MB`;

});

// =====================================
// COMPROBAR DURACIÓN DE LOS VIDEOS
// =====================================

function obtenerDuracion(archivo) {

    return new Promise((resolve, reject) => {

        const video = document.createElement("video");

        const url = URL.createObjectURL(archivo);

        video.preload = "metadata";

        video.onloadedmetadata = function () {

            const duracion = video.duration;

            URL.revokeObjectURL(url);

            if (!Number.isFinite(duracion)) {

                reject(new Error(
                    `No se pudo comprobar la duración de ${archivo.name}.`
                ));

                return;
            }

            resolve(duracion);

        };

        video.onerror = function () {

            URL.revokeObjectURL(url);

            reject(new Error(
                `No se pudo leer el video ${archivo.name}.`
            ));

        };

        video.src = url;

    });

}

// =====================================
// GENERAR IDENTIFICADOR ÚNICO
// =====================================

function generarToken() {

    return crypto.randomUUID().replace(/-/g, "");

}

// =====================================
// COMUNICACIÓN CON APPS SCRIPT
// =====================================

function llamarAppsScript(parametros) {

    return new Promise((resolve, reject) => {

        const callback =
            "respuesta_" +
            Date.now() +
            "_" +
            Math.floor(Math.random() * 1000000);

        const script = document.createElement("script");

        let limite;

        function limpiar() {

            delete window[callback];

            script.remove();

            clearTimeout(limite);

        }

        limite = setTimeout(() => {

            limpiar();

            reject(new Error(
                "Tiempo de espera agotado al consultar Apps Script."
            ));

        }, 20000);

        window[callback] = function (respuesta) {

            limpiar();

            if (!respuesta.ok) {

                reject(new Error(respuesta.error));

                return;
            }

            resolve(respuesta);

        };

        script.onerror = function () {

            limpiar();

            reject(new Error(
                "No se pudo comunicar con Google Apps Script."
            ));

        };

        const datos = new URLSearchParams({

            ...parametros,

            callback: callback

        });

        script.src =
            URL_APPS_SCRIPT + "?" + datos.toString();

        document.body.appendChild(script);

    });

}

// =====================================
// SOLICITAR SESIÓN DE CARGA
// =====================================

async function solicitarSesion(archivo, token) {

    const respuesta = await llamarAppsScript({

        accion: "crear",

        nombre: archivo.name,

        tipo: archivo.type,

        tamano: String(archivo.size),

        token: token

    });

    return respuesta.sessionUrl;

}

// =====================================
// ENVIAR ARCHIVO A GOOGLE DRIVE
// =====================================

function enviarArchivo(sessionUrl, archivo) {

    return new Promise((resolve, reject) => {

        const solicitud = new XMLHttpRequest();

        solicitud.open("PUT", sessionUrl);

        solicitud.setRequestHeader(
            "Content-Type",
            archivo.type
        );

        solicitud.upload.onprogress = function (evento) {

            if (evento.lengthComputable) {

                const porcentaje = Math.round(
                    (evento.loaded / evento.total) * 100
                );

                btnSubir.textContent =
                    `⏳ Subiendo ${archivo.name}: ${porcentaje}%`;

            }

        };

        solicitud.onload = function () {

            // La respuesta puede quedar bloqueada por CORS.
            // La verificación real se realiza después en Apps Script.

            resolve();

        };

        solicitud.onerror = function () {

            // No declaramos éxito todavía.
            // Primero verificaremos si Drive guardó el archivo.

            resolve();

        };

        solicitud.onabort = function () {

            reject(new Error(
                "La subida fue cancelada."
            ));

        };

        solicitud.send(archivo);

    });

}

// =====================================
// VERIFICAR ARCHIVO EN GOOGLE DRIVE
// =====================================

async function verificarArchivo(token) {

    for (let intento = 1; intento <= 10; intento++) {

        const respuesta = await llamarAppsScript({

            accion: "verificar",

            token: token

        });

        if (respuesta.encontrado) {

            return true;

        }

        // Esperar tres segundos antes de volver a consultar.

        await new Promise(resolve =>
            setTimeout(resolve, 3000)
        );

    }

    return false;

}

// =====================================
// SUBIR UN ARCHIVO COMPLETO
// =====================================

async function subirArchivo(archivo) {

    const token = generarToken();

    // 1. Solicitar sesión a Google Drive.

    const sessionUrl =
        await solicitarSesion(archivo, token);

    // 2. Enviar el archivo.

    await enviarArchivo(sessionUrl, archivo);

    // 3. Comprobar que realmente se guardó.

    const guardado =
        await verificarArchivo(token);

    if (!guardado) {

        throw new Error(
            `No pudimos confirmar que "${archivo.name}" se haya guardado en Google Drive.`
        );

    }

    return true;

}

// =====================================
// BOTÓN PARA SUBIR TODOS LOS ARCHIVOS
// =====================================

btnSubir.addEventListener("click", async function () {

    const archivos = Array.from(archivosInput.files);

    if (archivos.length === 0) {

        alert(
            "📸 Primero selecciona alguna foto o vídeo."
        );

        return;
    }

    btnSubir.disabled = true;

    try {

        // ---------------------------------
        // VALIDAR TODOS LOS ARCHIVOS
        // ---------------------------------

        for (const archivo of archivos) {

            if (
                !archivo.type.startsWith("image/") &&
                !archivo.type.startsWith("video/")
            ) {

                throw new Error(
                    `${archivo.name} no es una foto ni un video permitido.`
                );

            }

            if (archivo.type.startsWith("video/")) {

                const duracion =
                    await obtenerDuracion(archivo);

                if (duracion > DURACION_MAXIMA) {

                    throw new Error(
                        `El video "${archivo.name}" dura ${duracion.toFixed(1)} segundos. El máximo permitido es 30 segundos.`
                    );

                }

            }

        }

        // ---------------------------------
        // SUBIR ARCHIVOS UNO POR UNO
        // ---------------------------------

        let exitosos = 0;

        for (let i = 0; i < archivos.length; i++) {

            const archivo = archivos[i];

            btnSubir.textContent =
                `⏳ Archivo ${i + 1} de ${archivos.length}`;

            await subirArchivo(archivo);

            exitosos++;

        }

        // ---------------------------------
        // RESULTADO FINAL
        // ---------------------------------

        alert(
            `💕 ¡Perfecto! Se guardaron correctamente ${exitosos} archivo(s) en Google Drive.`
        );

        archivosInput.value = "";

        nombreArchivos.textContent =
            "No has seleccionado ningún archivo.";

    } catch (error) {

        console.error(error);

        alert("❌ " + error.message);

    } finally {

        btnSubir.disabled = false;

        btnSubir.textContent =
            "💕 Compartir recuerdos";

    }

});

import { BadRequestException, ConflictException } from '@nestjs/common';
import { FechasVoluntariadoService } from './fechas-voluntariado.service';
import { VoluntariadoService } from './voluntariado.service';
import { FechaVoluntariado } from '../entities/fecha-voluntariado.entity';
import { SolicitudVoluntariado } from '../entities/solicitud-voluntariado.entity';
import { hoyIsoEnZona } from '../common/timezone.util';

describe('Voluntariado Fechas y Cancelación (Unit & Acceptance Tests)', () => {
  let fechasService: FechasVoluntariadoService;
  let voluntariadoService: VoluntariadoService;

  let fechaRepoMock: any;
  let solicitudRepoMock: any;
  let emailServiceMock: any;

  beforeEach(() => {
    // Repositorio Mock de Fechas
    const fechasData: FechaVoluntariado[] = [];
    fechaRepoMock = {
      data: fechasData,
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn(async (entity) => {
        const idx = fechasData.findIndex(
          (f) => f.TipoVoluntariado === entity.TipoVoluntariado && f.Fecha === entity.Fecha,
        );
        if (idx >= 0) {
          fechasData[idx] = { ...fechasData[idx], ...entity };
          return fechasData[idx];
        }
        const created = { Id: fechasData.length + 1, ...entity };
        fechasData.push(created);
        return created;
      }),
      findOne: jest.fn(async ({ where }) => {
        const conds = Array.isArray(where) ? where : [where];
        for (const cond of conds) {
          const found = fechasData.find((f) => {
            let matches = true;
            if (cond.TipoVoluntariado && f.TipoVoluntariado !== cond.TipoVoluntariado) matches = false;
            if (cond.Fecha && f.Fecha !== cond.Fecha) matches = false;
            if (cond.Habilitada !== undefined && f.Habilitada !== cond.Habilitada) matches = false;
            return matches;
          });
          if (found) return found;
        }
        return null;
      }),
      remove: jest.fn(async (entity) => {
        const idx = fechasData.findIndex(
          (f) => f.TipoVoluntariado === entity.TipoVoluntariado && f.Fecha === entity.Fecha,
        );
        if (idx >= 0) fechasData.splice(idx, 1);
        return entity;
      }),
      createQueryBuilder: jest.fn(() => {
        let filtroTipo: string | null = null;
        let filtroInicio: string | null = null;
        let filtroHasta: string | null = null;
        let filtroHabilitada: boolean | null = null;

        const builder: any = {
          where: jest.fn((sql, params) => {
            if (params?.habilitada !== undefined) filtroHabilitada = params.habilitada;
            return builder;
          }),
          andWhere: jest.fn((sql, params) => {
            if (params?.inicio) filtroInicio = params.inicio;
            if (params?.hoy) filtroInicio = params.hoy;
            if (params?.desde) filtroInicio = params.desde;
            if (params?.hasta) filtroHasta = params.hasta;
            if (params?.tipo) filtroTipo = params.tipo;
            return builder;
          }),
          select: jest.fn(() => builder),
          addSelect: jest.fn(() => builder),
          groupBy: jest.fn(() => builder),
          orderBy: jest.fn(() => builder),
          getMany: jest.fn(async () => {
            return fechasData.filter((f) => {
              if (filtroHabilitada !== null && f.Habilitada !== filtroHabilitada) return false;
              if (filtroInicio && f.Fecha < filtroInicio) return false;
              if (filtroHasta && f.Fecha > filtroHasta) return false;
              if (filtroTipo && f.TipoVoluntariado.toLowerCase() !== filtroTipo.toLowerCase()) return false;
              return true;
            });
          }),
          getRawMany: jest.fn(async () => {
            return [];
          }),
        };
        return builder;
      }),
    };

    // Repositorio Mock de Solicitudes
    const solicitudesData: SolicitudVoluntariado[] = [];
    solicitudRepoMock = {
      data: solicitudesData,
      create: jest.fn((dto) => ({ ...dto, Id: String(solicitudesData.length + 1) })),
      save: jest.fn(async (entity) => {
        const idx = solicitudesData.findIndex((s) => s.Id === entity.Id);
        if (idx >= 0) {
          solicitudesData[idx] = { ...solicitudesData[idx], ...entity };
          return solicitudesData[idx];
        }
        const created = { Id: String(solicitudesData.length + 1), ...entity };
        solicitudesData.push(created);
        return created;
      }),
      findOne: jest.fn(async ({ where }) => {
        return solicitudesData.find((s) => s.Id === where.Id) || null;
      }),
      remove: jest.fn(async (entity) => {
        const idx = solicitudesData.findIndex((s) => s.Id === entity.Id);
        if (idx >= 0) solicitudesData.splice(idx, 1);
        return entity;
      }),
      createQueryBuilder: jest.fn(() => {
        let paramFecha: string | null = null;
        let paramTipo: string | null = null;

        const builder: any = {
          where: jest.fn((sql, params) => {
            if (params?.fechaParam) paramFecha = params.fechaParam.replaceAll('%', '');
            return builder;
          }),
          andWhere: jest.fn((sql, params) => {
            if (params?.t) paramTipo = params.t;
            return builder;
          }),
          orderBy: jest.fn(() => builder),
          getMany: jest.fn(async () => {
            return solicitudesData.filter((s) => {
              if (paramFecha && (!s.Dias || !s.Dias.includes(paramFecha))) return false;
              if (paramTipo && s.TipoVoluntariado && s.TipoVoluntariado.toLowerCase() !== paramTipo.toLowerCase()) {
                if (paramTipo.toLowerCase() === 'apoyo general' && s.TipoVoluntariado === 'General') {
                  // match
                } else {
                  return false;
                }
              }
              return true;
            });
          }),
        };
        return builder;
      }),
    };

    // Mock EmailService
    emailServiceMock = {
      enviarCancelacionActividadVoluntariado: jest.fn(async () => true),
    };

    fechasService = new FechasVoluntariadoService(
      fechaRepoMock,
      solicitudRepoMock,
      emailServiceMock,
    );

    voluntariadoService = new VoluntariadoService(
      solicitudRepoMock,
      fechasService,
    );
  });

  describe('TAREA 1: Zona horaria y origen de fechas disponibles vigentes', () => {
    it('debe calcular la fecha hoy en la zona horaria de Costa Rica y cambiar de día consistentemente', () => {
      const hoyCR = hoyIsoEnZona('America/Costa_Rica');
      expect(hoyCR).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const config = fechasService.obtenerConfigZonaHoraria();
      expect(config.zonaHoraria).toBe('America/Costa_Rica');
      expect(config.hoy).toBe(hoyCR);
    });

    it('no debe mostrar ni aceptar fechas previas a hoy en listarDisponibles aunque se manipule el query param desde', async () => {
      const hoy = hoyIsoEnZona();
      const fechaAyer = '2020-01-01';
      const fechaManana = '2030-01-01';

      // Sembrar fecha pasada habilitada y fecha futura habilitada
      await fechaRepoMock.save({
        TipoVoluntariado: 'Apoyo General',
        Fecha: fechaAyer,
        Habilitada: true,
        Horarios: ['Mañana'],
      });
      await fechaRepoMock.save({
        TipoVoluntariado: 'Apoyo General',
        Fecha: fechaManana,
        Habilitada: true,
        Horarios: ['Mañana'],
      });

      // Si se consulta con desde en el pasado (manipulado)
      const disponibles = await fechasService.listarDisponibles('Apoyo General', '1990-01-01');
      expect(disponibles.some((f) => f.Fecha < hoy)).toBe(false);
      expect(disponibles.some((f) => f.Fecha === fechaManana)).toBe(true);
    });

    it('estaFechaYHorarioHabilitada debe rechazar fechas pasadas con mensaje claro', async () => {
      const resultado = await fechasService.estaFechaYHorarioHabilitada('Apoyo General', '2020-01-01');
      expect(resultado.valida).toBe(false);
      expect(resultado.mensajeError).toContain('No se pueden solicitar voluntariados en fechas pasadas');
    });

    it('voluntariadoService.crear debe rechazar solicitudes enviadas con fecha pasada manipulada', async () => {
      await expect(
        voluntariadoService.crear({
          UserId: 'user-1',
          TipoVoluntariado: 'Apoyo General',
          Dias: '2020-01-01',
          Horario: 'Mañana',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('fechas históricas siguen consultables en administración mediante listarTodas', async () => {
      await fechaRepoMock.save({
        TipoVoluntariado: 'Apoyo General',
        Fecha: '2021-05-10',
        Habilitada: false,
        Horarios: ['Mañana'],
      });

      const todas = await fechasService.listarTodas();
      expect(todas.some((f) => f.Fecha === '2021-05-10')).toBe(true);
    });
  });

  describe('TAREA 2: Detección de participantes, confirmación de cancelación, conservación y notificación', () => {
    const fechaFutura = '2030-06-15';

    beforeEach(async () => {
      // Registrar fecha futura habilitada
      await fechaRepoMock.save({
        TipoVoluntariado: 'Apoyo General',
        Fecha: fechaFutura,
        Habilitada: true,
        Horarios: ['Mañana (8:00 a. m. – 12:00 m.)'],
      });
    });

    it('debe permitir deshabilitar o eliminar directamente una fecha futura cuando tiene CERO inscritos', async () => {
      const vinculadas = await fechasService.obtenerSolicitudesVinculadas('Apoyo General', fechaFutura);
      expect(vinculadas.activas).toBe(0);

      // Deshabilitar sin confirmación adicional cuando no hay inscritos
      const res = await fechasService.actualizarEstado('Apoyo General', fechaFutura, false);
      expect(res.Habilitada).toBe(false);
    });

    it('debe detectar solicitudes vinculadas y solicitar confirmación de cancelación (ConflictException) si existen participantes', async () => {
      // Inscribir un participante
      await solicitudRepoMock.save({
        UserId: 'user-10',
        TipoVoluntariado: 'Apoyo General',
        Dias: fechaFutura,
        Estado: 'Pendiente',
        Nombre: 'Juan Perez',
        Email: 'juan@example.com',
      });

      const vinculadas = await fechasService.obtenerSolicitudesVinculadas('Apoyo General', fechaFutura);
      expect(vinculadas.activas).toBe(1);

      // Intentar deshabilitar sin confirmación previa
      await expect(
        fechasService.actualizarEstado('Apoyo General', fechaFutura, false, [], null, '', false),
      ).rejects.toThrow(ConflictException);

      // Intentar eliminar sin confirmación previa
      await expect(
        fechasService.eliminarFecha('Apoyo General', fechaFutura, false),
      ).rejects.toThrow(ConflictException);
    });

    it('al confirmar cancelación: conserva solicitudes (no se borran), cambia estado a Cancelada y notifica con orientación', async () => {
      // Inscribir varios participantes
      await solicitudRepoMock.save({
        Id: 'sol-1',
        UserId: 'user-1',
        TipoVoluntariado: 'Apoyo General',
        Dias: fechaFutura,
        Estado: 'Pendiente',
        Nombre: 'Ana Lopez',
        Email: 'ana@example.com',
        Horario: 'Mañana',
      });
      await solicitudRepoMock.save({
        Id: 'sol-2',
        UserId: 'user-2',
        TipoVoluntariado: 'Apoyo General',
        Dias: fechaFutura,
        Estado: 'Aprobado',
        Nombre: 'Carlos Gomez',
        Email: 'carlos@example.com',
        Horario: 'Mañana',
      });

      // Confirmar cancelación y retirar fecha
      const orientacion = 'Debido a remodelación, favor elegir una nueva fecha en el sitio.';
      const res = await fechasService.cancelarActividadYRetirarFecha(
        'Apoyo General',
        fechaFutura,
        'deshabilitar',
        orientacion,
      );

      expect(res.ok).toBe(true);
      expect(res.solicitudesCanceladas).toBe(2);
      expect(res.notificacionesExitosas).toBe(2);

      // Verificar que NO se borraron las solicitudes de la base de datos
      expect(solicitudRepoMock.data.length).toBe(2);

      // Verificar que cambiaron a estado 'Cancelada'
      const sol1 = solicitudRepoMock.data.find((s: any) => s.Id === 'sol-1');
      const sol2 = solicitudRepoMock.data.find((s: any) => s.Id === 'sol-2');
      expect(sol1.Estado).toBe('Cancelada');
      expect(sol2.Estado).toBe('Cancelada');
      expect(sol1.ObservacionesAdmin).toContain(orientacion);
      expect(sol1.NotificacionCancelacionEnviada).toBe(true);

      // Verificar que EmailService fue llamado para cada participante con orientación
      expect(emailServiceMock.enviarCancelacionActividadVoluntariado).toHaveBeenCalledTimes(2);
      expect(emailServiceMock.enviarCancelacionActividadVoluntariado).toHaveBeenCalledWith(
        'ana@example.com',
        expect.objectContaining({
          fechaActividad: fechaFutura,
          orientacion,
        }),
      );
    });

    it('reintentos no deben duplicar avisos a participantes ya notificados', async () => {
      await solicitudRepoMock.save({
        Id: 'sol-1',
        UserId: 'user-1',
        TipoVoluntariado: 'Apoyo General',
        Dias: fechaFutura,
        Estado: 'Cancelada',
        Nombre: 'Participante 1',
        Email: 'p1@example.com',
        NotificacionCancelacionEnviada: true, // ya notificado previamente
      });

      await solicitudRepoMock.save({
        Id: 'sol-2',
        UserId: 'user-2',
        TipoVoluntariado: 'Apoyo General',
        Dias: fechaFutura,
        Estado: 'Cancelada',
        Nombre: 'Participante 2',
        Email: 'p2@example.com',
        NotificacionCancelacionEnviada: false, // pendiente / falló antes
      });

      emailServiceMock.enviarCancelacionActividadVoluntariado.mockClear();

      const resReintento = await fechasService.reintentarNotificaciones('Apoyo General', fechaFutura);

      expect(resReintento.totalPendientes).toBe(1);
      expect(resReintento.notificacionesExitosas).toBe(1);

      // Solo debe haberse llamado para p2@example.com, NUNCA para p1@example.com
      expect(emailServiceMock.enviarCancelacionActividadVoluntariado).toHaveBeenCalledTimes(1);
      expect(emailServiceMock.enviarCancelacionActividadVoluntariado).toHaveBeenCalledWith(
        'p2@example.com',
        expect.anything(),
      );

      // Ahora ambos están en true
      const sol2 = solicitudRepoMock.data.find((s: any) => s.Id === 'sol-2');
      expect(sol2.NotificacionCancelacionEnviada).toBe(true);

      // Un segundo reintento no envía ningún aviso adicional
      emailServiceMock.enviarCancelacionActividadVoluntariado.mockClear();
      const resSegundoReintento = await fechasService.reintentarNotificaciones('Apoyo General', fechaFutura);
      expect(resSegundoReintento.totalPendientes).toBe(0);
      expect(emailServiceMock.enviarCancelacionActividadVoluntariado).not.toHaveBeenCalled();
    });

    it('manejo de fallo de correo: registra fallido y permite reintento posterior', async () => {
      await solicitudRepoMock.save({
        Id: 'sol-fallo',
        UserId: 'user-fallo',
        TipoVoluntariado: 'Apoyo General',
        Dias: fechaFutura,
        Estado: 'Pendiente',
        Nombre: 'Usuario Fallo',
        Email: 'fallo@example.com',
        NotificacionCancelacionEnviada: false,
      });

      // Simular fallo en envío de correo
      emailServiceMock.enviarCancelacionActividadVoluntariado.mockResolvedValueOnce(false);

      const res = await fechasService.cancelarActividadYRetirarFecha(
        'Apoyo General',
        fechaFutura,
        'deshabilitar',
        'Aviso de prueba',
      );

      expect(res.notificacionesFallidas).toBe(1);
      expect(res.fallidos.length).toBe(1);
      expect(res.fallidos[0].email).toBe('fallo@example.com');

      // NotificacionCancelacionEnviada debe permanecer false
      const sol = solicitudRepoMock.data.find((s: any) => s.Id === 'sol-fallo');
      expect(sol.NotificacionCancelacionEnviada).toBe(false);

      // Al recuperarse el servicio de correo, reintentar funciona
      emailServiceMock.enviarCancelacionActividadVoluntariado.mockResolvedValueOnce(true);
      const resReintento = await fechasService.reintentarNotificaciones('Apoyo General', fechaFutura);
      expect(resReintento.notificacionesExitosas).toBe(1);
      expect(sol.NotificacionCancelacionEnviada).toBe(true);
    });
  });
});

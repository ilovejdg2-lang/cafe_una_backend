import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DatosClienteRegistro } from '../common/cliente-registro.util';
import { ClienteJuridico } from '../entities/cliente-juridico.entity';
import { Cliente } from '../entities/cliente.entity';

export type FichaClientePlana = {
  TipoCliente: 'persona' | 'empresa';
  Telefono: string | null;
  NombreLegal: string | null;
  TipoDocumento: string | null;
  Apellidos: string | null;
  Identificacion: string | null;
  RazonSocial: string | null;
  NombreComercial: string | null;
  RepresentanteLegal: string | null;
  CedulaJuridica: string | null;
  DireccionFiscal: string | null;
  TelefonoOficina: string | null;
  FechaRegistroCliente: Date | null;
  FechaVerificacionCliente: Date | null;
};

const FICHA_VACIA: FichaClientePlana = {
  TipoCliente: null as unknown as 'persona' | 'empresa',
  Telefono: null,
  NombreLegal: null,
  TipoDocumento: null,
  Apellidos: null,
  Identificacion: null,
  RazonSocial: null,
  NombreComercial: null,
  RepresentanteLegal: null,
  CedulaJuridica: null,
  DireccionFiscal: null,
  TelefonoOficina: null,
  FechaRegistroCliente: null,
  FechaVerificacionCliente: null,
};

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clientesRepo: Repository<Cliente>,
    @InjectRepository(ClienteJuridico)
    private readonly juridicosRepo: Repository<ClienteJuridico>,
  ) {}

  fichaVacia(): Omit<FichaClientePlana, 'TipoCliente'> & {
    TipoCliente: string | null;
  } {
    return { ...FICHA_VACIA, TipoCliente: null };
  }

  async obtenerFichaPorUsuarioId(
    usuarioId: number,
  ): Promise<(Omit<FichaClientePlana, 'TipoCliente'> & { TipoCliente: string | null }) | null> {
    const persona = await this.clientesRepo.findOne({
      where: { UsuarioId: usuarioId },
    });
    if (persona) return this.planaDesdePersona(persona);

    const empresa = await this.juridicosRepo.findOne({
      where: { UsuarioId: usuarioId },
    });
    if (empresa) return this.planaDesdeEmpresa(empresa);

    return null;
  }

  async mapFichasPorUsuarioIds(
    usuarioIds: number[],
  ): Promise<Map<number, Omit<FichaClientePlana, 'TipoCliente'> & { TipoCliente: string | null }>> {
    const mapa = new Map<
      number,
      Omit<FichaClientePlana, 'TipoCliente'> & { TipoCliente: string | null }
    >();
    if (usuarioIds.length === 0) return mapa;

    const personas = await this.clientesRepo.find({
      where: { UsuarioId: In(usuarioIds) },
    });
    for (const row of personas) {
      mapa.set(row.UsuarioId, this.planaDesdePersona(row));
    }

    const faltantes = usuarioIds.filter((id) => !mapa.has(id));
    if (faltantes.length === 0) return mapa;

    const empresas = await this.juridicosRepo.find({
      where: { UsuarioId: In(faltantes) },
    });
    for (const row of empresas) {
      mapa.set(row.UsuarioId, this.planaDesdeEmpresa(row));
    }

    return mapa;
  }

  async guardarDesdeDatos(
    usuarioId: number,
    datos: DatosClienteRegistro,
  ): Promise<void> {
    await this.eliminarPorUsuarioId(usuarioId);
    const ahora = new Date();

    if (datos.tipo === 'persona') {
      await this.clientesRepo.save(
        this.clientesRepo.create({
          UsuarioId: usuarioId,
          Nombre: (datos.nombreLegal || '').trim(),
          Apellidos: (datos.apellidos || '').trim(),
          TipoDocumento: datos.tipoDocumento || 'cedula',
          Identificacion: (datos.identificacion || '').trim(),
          Telefono: datos.telefono,
          FechaRegistro: ahora,
          FechaVerificacion: ahora,
        }),
      );
      return;
    }

    await this.juridicosRepo.save(
      this.juridicosRepo.create({
        UsuarioId: usuarioId,
        RazonSocial: (datos.razonSocial || '').trim(),
        NombreComercial: (datos.nombreComercial || '').trim(),
        RepresentanteLegal: (datos.representanteLegal || '').trim(),
        CedulaJuridica: (datos.cedulaJuridica || '').trim(),
        DireccionFiscal: datos.direccionFiscal?.trim() || null,
        Telefono: datos.telefono,
        TelefonoOficina: datos.telefonoOficina?.trim() || null,
        FechaRegistro: ahora,
        FechaVerificacion: ahora,
      }),
    );
  }

  async actualizarDesdeDatos(
    usuarioId: number,
    datos: DatosClienteRegistro,
  ): Promise<Omit<FichaClientePlana, 'TipoCliente'> & { TipoCliente: string | null }> {
    const existente = await this.obtenerFichaPorUsuarioId(usuarioId);
    if (!existente?.TipoCliente) {
      throw new Error('Esta cuenta no tiene ficha de cliente para editar.');
    }
    if (existente.TipoCliente !== datos.tipo) {
      throw new Error('No se puede cambiar el tipo de cliente desde el perfil.');
    }

    const ahora = new Date();
    if (datos.tipo === 'persona') {
      const row = await this.clientesRepo.findOne({
        where: { UsuarioId: usuarioId },
      });
      if (!row) throw new Error('No se encontró la ficha de cliente.');
      row.Nombre = (datos.nombreLegal || '').trim();
      row.Apellidos = (datos.apellidos || '').trim();
      row.TipoDocumento = datos.tipoDocumento || 'cedula';
      row.Identificacion = (datos.identificacion || '').trim();
      row.Telefono = datos.telefono;
      row.FechaVerificacion = ahora;
      await this.clientesRepo.save(row);
      return this.planaDesdePersona(row);
    }

    const row = await this.juridicosRepo.findOne({
      where: { UsuarioId: usuarioId },
    });
    if (!row) throw new Error('No se encontró la ficha de cliente jurídico.');
    row.RazonSocial = (datos.razonSocial || '').trim();
    row.NombreComercial = (datos.nombreComercial || '').trim();
    row.RepresentanteLegal = (datos.representanteLegal || '').trim();
    row.CedulaJuridica = (datos.cedulaJuridica || '').trim();
    row.DireccionFiscal = datos.direccionFiscal?.trim() || null;
    row.Telefono = datos.telefono;
    row.TelefonoOficina = datos.telefonoOficina?.trim() || null;
    row.FechaVerificacion = ahora;
    await this.juridicosRepo.save(row);
    return this.planaDesdeEmpresa(row);
  }

  async eliminarPorUsuarioId(usuarioId: number): Promise<void> {
    await this.clientesRepo.delete({ UsuarioId: usuarioId });
    await this.juridicosRepo.delete({ UsuarioId: usuarioId });
  }

  async tieneFicha(usuarioId: number): Promise<boolean> {
    const ficha = await this.obtenerFichaPorUsuarioId(usuarioId);
    return Boolean(ficha?.TipoCliente);
  }

  private planaDesdePersona(
    row: Cliente,
  ): Omit<FichaClientePlana, 'TipoCliente'> & { TipoCliente: 'persona' } {
    return {
      TipoCliente: 'persona',
      Telefono: row.Telefono,
      NombreLegal: row.Nombre,
      TipoDocumento: row.TipoDocumento,
      Apellidos: row.Apellidos,
      Identificacion: row.Identificacion,
      RazonSocial: null,
      NombreComercial: null,
      RepresentanteLegal: null,
      CedulaJuridica: null,
      DireccionFiscal: null,
      TelefonoOficina: null,
      FechaRegistroCliente: row.FechaRegistro,
      FechaVerificacionCliente: row.FechaVerificacion,
    };
  }

  private planaDesdeEmpresa(
    row: ClienteJuridico,
  ): Omit<FichaClientePlana, 'TipoCliente'> & { TipoCliente: 'empresa' } {
    return {
      TipoCliente: 'empresa',
      Telefono: row.Telefono,
      NombreLegal: null,
      TipoDocumento: null,
      Apellidos: null,
      Identificacion: null,
      RazonSocial: row.RazonSocial,
      NombreComercial: row.NombreComercial,
      RepresentanteLegal: row.RepresentanteLegal,
      CedulaJuridica: row.CedulaJuridica,
      DireccionFiscal: row.DireccionFiscal,
      TelefonoOficina: row.TelefonoOficina,
      FechaRegistroCliente: row.FechaRegistro,
      FechaVerificacionCliente: row.FechaVerificacion,
    };
  }
}

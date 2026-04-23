import { Injectable, Logger, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';

export interface RemnaCreateUserInput {
  username: string;
  expireAt: string;
  trafficLimitBytes?: number;
  trafficLimitStrategy?: 'NO_RESET' | 'DAY' | 'WEEK' | 'MONTH';
  activeInternalSquads?: string[];
  description?: string;
  telegramId?: number;
  status?: 'ACTIVE' | 'DISABLED';
  hwidDeviceLimit?: number;
  tag?: string;
}

export interface RemnaHwidDevice {
  hwid: string;
  userUuid: string;
  platform: string | null;
  osVersion: string | null;
  deviceModel: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RemnaUser {
  uuid: string;
  shortUuid?: string;
  username: string;
  status: string;
  expireAt?: string;
  subscriptionUrl?: string;
  trafficLimitBytes?: number;
  usedTrafficBytes?: number;
  activeInternalSquads?: { uuid: string }[] | string[];
  tag?: string | null;
  description?: string | null;
  telegramId?: number | null;
  hwidDeviceLimit?: number | null;
  onlineAt?: string | null;
  firstConnectedAt?: string | null;
  lastTrafficResetAt?: string | null;
  [k: string]: unknown;
}

/**
 * Thin typed wrapper around Remnawave Panel HTTP API.
 * Endpoints follow the paths used by the official Python SDK controllers.
 * Paths / payload shapes should be cross-checked against the panel's
 * OpenAPI (https://cdn.docs.rw/docs/openapi.json) on the deployed version.
 */
@Injectable()
export class RemnawaveService {
  private readonly http: AxiosInstance;
  private readonly log = new Logger(RemnawaveService.name);
  private readonly baseUrl: string;

  constructor(cfg: ConfigService) {
    this.baseUrl = cfg.getOrThrow<string>('REMNAWAVE_BASE_URL');
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 15_000,
      headers: {
        Authorization: `Bearer ${cfg.getOrThrow<string>('REMNAWAVE_TOKEN')}`,
        'Content-Type': 'application/json',
      },
    });

    this.http.interceptors.response.use(
      (r) => r,
      (err: AxiosError) => {
        const status = err.response?.status ?? 502;
        this.log.error(
          `Remnawave ${err.config?.method?.toUpperCase()} ${err.config?.url} → ${status} ${JSON.stringify(err.response?.data)}`,
        );
        throw new HttpException(
          { source: 'remnawave', message: (err.response?.data as any)?.message ?? err.message, data: err.response?.data },
          status >= 400 && status < 600 ? status : 502,
        );
      },
    );
  }

  // ---- Users ----
  async createUser(dto: RemnaCreateUserInput): Promise<RemnaUser> {
    const { data } = await this.http.post('/api/users', dto);
    return (data.response ?? data) as RemnaUser;
  }

  async getUserByUuid(uuid: string): Promise<RemnaUser> {
    const { data } = await this.http.get(`/api/users/${uuid}`);
    return (data.response ?? data) as RemnaUser;
  }

  async listUsers(params: { size?: number; start?: number; search?: string } = {}): Promise<{ total: number; users: RemnaUser[] }> {
    const { data } = await this.http.get('/api/users', { params });
    const r = data.response ?? data;
    return { total: r.total ?? 0, users: r.users ?? [] };
  }

  async updateUser(uuid: string, patch: Partial<RemnaCreateUserInput>): Promise<RemnaUser> {
    const { data } = await this.http.patch(`/api/users/${uuid}`, patch);
    return (data.response ?? data) as RemnaUser;
  }

  async deleteUser(uuid: string): Promise<void> {
    await this.http.delete(`/api/users/${uuid}`);
  }

  async disableUser(uuid: string): Promise<RemnaUser> {
    const { data } = await this.http.post(`/api/users/${uuid}/disable`);
    return (data.response ?? data) as RemnaUser;
  }

  async enableUser(uuid: string): Promise<RemnaUser> {
    const { data } = await this.http.post(`/api/users/${uuid}/enable`);
    return (data.response ?? data) as RemnaUser;
  }

  async resetTraffic(uuid: string): Promise<RemnaUser> {
    const { data } = await this.http.post(`/api/users/${uuid}/reset-traffic`);
    return (data.response ?? data) as RemnaUser;
  }

  async userUsage(uuid: string, start: string, end: string): Promise<unknown> {
    const { data } = await this.http.get(`/api/users/${uuid}/usage`, { params: { start, end } });
    return data.response ?? data;
  }

  // ---- System tools ----
  async encryptHappCryptoLink(linkToEncrypt: string): Promise<string> {
    const { data } = await this.http.post('/api/system/tools/happ/encrypt', { linkToEncrypt });
    const r = data.response ?? data;
    return r.encryptedLink as string;
  }

  // ---- HWID devices ----
  async listUserHwidDevices(userUuid: string): Promise<{ total: number; devices: RemnaHwidDevice[] }> {
    const { data } = await this.http.get(`/api/hwid/devices/${userUuid}`);
    const r = data.response ?? data;
    return { total: r.total ?? 0, devices: (r.devices ?? []) as RemnaHwidDevice[] };
  }

  async deleteUserHwidDevice(userUuid: string, hwid: string): Promise<{ total: number; devices: RemnaHwidDevice[] }> {
    const { data } = await this.http.post('/api/hwid/devices/delete', { userUuid, hwid });
    const r = data.response ?? data;
    return { total: r.total ?? 0, devices: (r.devices ?? []) as RemnaHwidDevice[] };
  }

  // ---- Squads ----
  async listInternalSquads(): Promise<Array<{ uuid: string; name: string }>> {
    const { data } = await this.http.get('/api/internal-squads');
    const r = data.response ?? data;
    return (r.squads ?? r) as Array<{ uuid: string; name: string }>;
  }
}

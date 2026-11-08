"use client";

import {
  Account,
  Client,
  EmailBillingLog,
  Notification,
  Order,
  Settings,
  SyncLog,
  UnlinkedCampaign,
  WhatsAppLog,
  normalizeCustomerId,
} from "../types";
import { calculateOrderMetrics, calculateRealizedLeverage } from "../calculations";
import { createClient } from "../supabase/client";
import { AppState, INITIAL_DEMO_DATA } from "./demo-data";

export type { AppState };
export { INITIAL_DEMO_DATA };

const STORAGE_KEY = "promo_crm_data_v2";

class MockStore {
  private state: AppState;
  private listeners: Set<() => void> = new Set();
  private supabaseClient: any = null;
  private isSupabaseSyncing = false;

  constructor() {
    this.state = this.loadState();
    if (typeof window !== "undefined") {
      this.initSupabaseSync();
    }
  }

  private loadState(): AppState {
    if (typeof window === "undefined") {
      return INITIAL_DEMO_DATA;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isDemoUser === false) {
          // Real user session: strictly isolate user data, never inject demo items
          return {
            ...parsed,
            accounts: parsed.accounts || [],
            orders: parsed.orders || [],
            clients: parsed.clients || [],
            notifications: parsed.notifications || [],
            unlinkedCampaigns: parsed.unlinkedCampaigns || [],
            syncLogs: parsed.syncLogs || [],
            emailBillingLogs: parsed.emailBillingLogs || [],
            whatsAppLogs: parsed.whatsAppLogs || [],
          };
        }
        return {
          ...INITIAL_DEMO_DATA,
          ...parsed,
          unlinkedCampaigns:
            parsed.unlinkedCampaigns || INITIAL_DEMO_DATA.unlinkedCampaigns,
        };
      }
    } catch {
      // Fallback
    }
    return INITIAL_DEMO_DATA;
  }

  private saveState() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        // ignore
      }
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): AppState {
    return this.state;
  }

  /**
   * Initializes real-time synchronization with Supabase Postgres when authenticated
   */
  async initSupabaseSync() {
    if (this.isSupabaseSyncing) return;
    this.supabaseClient = createClient();

    if (!this.supabaseClient) {
      this.state.isSupabaseConnected = false;
      this.notify();
      return;
    }

    try {
      this.isSupabaseSyncing = true;
      const {
        data: { session },
      } = await this.supabaseClient.auth.getSession();

      if (!session || !session.user) {
        // User not logged into Supabase auth, stay in demo mode
        this.state.isSupabaseConnected = false;
        this.notify();
        return;
      }

      const userId = session.user.id;
      this.state.isDemoUser = false;
      this.state.currentUserEmail = session.user.email;
      this.state.isSupabaseConnected = true;

      // 1. Fetch user settings or create default
      let { data: settings } = await this.supabaseClient
        .from("settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!settings) {
        const defaultSettings = {
          user_id: userId,
          usd_to_inr: 88.0,
          alert_threshold_percent: 85.0,
          auto_pause: false,
          notification_channel: "email",
        };
        const { data: createdSettings } = await this.supabaseClient
          .from("settings")
          .insert(defaultSettings)
          .select()
          .single();
        settings = createdSettings || defaultSettings;
      }

      if (settings) {
        this.state.settings = { ...this.state.settings, ...settings };
      }

      // 2. Fetch user's real accounts, orders, clients, notifications, unlinked campaigns, sync logs
      const [
        { data: accounts },
        { data: orders },
        { data: clients },
        { data: notifications },
        { data: unlinked },
        { data: syncLogs },
      ] = await Promise.all([
        this.supabaseClient.from("accounts").select("*").eq("user_id", userId),
        this.supabaseClient.from("orders").select("*").eq("user_id", userId),
        this.supabaseClient.from("clients").select("*").eq("user_id", userId),
        this.supabaseClient
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        this.supabaseClient
          .from("unlinked_campaigns")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        this.supabaseClient
          .from("sync_logs")
          .select("*")
          .eq("user_id", userId)
          .order("timestamp", { ascending: false })
          .limit(20),
      ]);

      if (accounts) this.state.accounts = accounts;
      if (orders) this.state.orders = orders;
      if (clients) this.state.clients = clients;
      if (notifications) this.state.notifications = notifications;
      if (unlinked) this.state.unlinkedCampaigns = unlinked;
      if (syncLogs) this.state.syncLogs = syncLogs;

      this.saveState();

      // 3. Setup Supabase Realtime channel for instant multi-device / phone sync
      this.supabaseClient
        .channel(`user-sync-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", filter: `user_id=eq.${userId}` },
          () => {
            // Re-fetch when Google Ads script or another phone updates data
            this.refetchSupabaseData(userId);
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("Supabase live sync fallback:", err);
    } finally {
      this.isSupabaseSyncing = false;
    }
  }

  private async refetchSupabaseData(userId: string) {
    if (!this.supabaseClient) return;
    try {
      const [
        { data: accs },
        { data: ords },
        { data: notifs },
        { data: unlinked },
        { data: syncLogs },
      ] = await Promise.all([
        this.supabaseClient.from("accounts").select("*").eq("user_id", userId),
        this.supabaseClient.from("orders").select("*").eq("user_id", userId),
        this.supabaseClient
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        this.supabaseClient
          .from("unlinked_campaigns")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        this.supabaseClient
          .from("sync_logs")
          .select("*")
          .eq("user_id", userId)
          .order("timestamp", { ascending: false })
          .limit(20),
      ]);
      if (accs) this.state.accounts = accs;
      if (ords) this.state.orders = ords;
      if (notifs) this.state.notifications = notifs;
      if (unlinked) this.state.unlinkedCampaigns = unlinked;
      if (syncLogs) this.state.syncLogs = syncLogs;
      this.saveState();
    } catch {
      // ignore
    }
  }

  resetDemoData() {
    this.state = JSON.parse(JSON.stringify(INITIAL_DEMO_DATA));
    this.saveState();
  }

  setRealUser(userId: string, email: string) {
    this.state.isDemoUser = false;
    this.state.currentUserEmail = email;
    this.state.isSupabaseConnected = Boolean(this.supabaseClient);
    this.state.settings.user_id = userId;
    this.state.accounts = [];
    this.state.orders = [];
    this.state.clients = [];
    this.state.notifications = [];
    this.state.syncLogs = [];
    this.state.emailBillingLogs = [];
    this.state.whatsAppLogs = [];
    this.state.unlinkedCampaigns = [];
    this.saveState();
  }

  async logout() {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("promo_crm_mode");
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    if (this.supabaseClient) {
      try {
        await this.supabaseClient.auth.signOut();
      } catch {
        // ignore
      }
    }
    this.state.isDemoUser = true;
    this.state.currentUserEmail = undefined;
    this.state.isSupabaseConnected = false;
    this.state.accounts = [];
    this.state.orders = [];
    this.state.clients = [];
    this.saveState();
  }

  /**
   * Permanently clears only the logged-in user's business data:
   * accounts, orders, clients, notifications, unlinked campaigns, sync_logs, email_billing_logs, whatsapp_logs.
   * NEVER deletes other users' data (strictly scoped to user_id and enforced by Supabase RLS).
   * NEVER deletes settings or sync secrets (sync_secret_hash, webhook_secret_hash remain preserved).
   */
  async clearUserData(): Promise<{ success: boolean; error?: string }> {
    const userId = this.state.settings.user_id;

    if (this.state.isSupabaseConnected && this.supabaseClient && userId && !this.state.isDemoUser) {
      try {
        // 1. Delete orders first to satisfy foreign key constraints
        await this.supabaseClient.from("orders").delete().eq("user_id", userId);
        // 2. Delete unlinked campaigns, notifications, and logs
        await Promise.all([
          this.supabaseClient.from("unlinked_campaigns").delete().eq("user_id", userId),
          this.supabaseClient.from("notifications").delete().eq("user_id", userId),
          this.supabaseClient.from("sync_logs").delete().eq("user_id", userId),
          this.supabaseClient.from("email_billing_logs").delete().eq("user_id", userId),
          this.supabaseClient.from("whatsapp_logs").delete().eq("user_id", userId),
        ]);
        // 3. Delete accounts and clients
        await Promise.all([
          this.supabaseClient.from("accounts").delete().eq("user_id", userId),
          this.supabaseClient.from("clients").delete().eq("user_id", userId),
        ]);
      } catch (err: any) {
        return { success: false, error: err.message || "Failed to clear database records" };
      }
    }

    // Clear local store
    this.state.accounts = [];
    this.state.orders = [];
    this.state.clients = [];
    this.state.notifications = [];
    this.state.syncLogs = [];
    this.state.emailBillingLogs = [];
    this.state.whatsAppLogs = [];
    this.state.unlinkedCampaigns = [];
    this.saveState();

    return { success: true };
  }

  // --- Settings ---
  async updateSettings(updates: Partial<Settings>) {
    this.state.settings = {
      ...this.state.settings,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.saveState();

    if (this.state.isSupabaseConnected && this.supabaseClient) {
      const userId = this.state.settings.user_id;
      await this.supabaseClient
        .from("settings")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    }
  }

  // --- Accounts ---
  async addAccount(
    account: Omit<Account, "id" | "user_id" | "created_at" | "updated_at">
  ): Promise<Account> {
    const tempId = `acc_${Date.now()}`;
    const cleanedCid = normalizeCustomerId(account.google_ads_customer_id);
    const newAcc: Account = {
      ...account,
      google_ads_customer_id: cleanedCid,
      id: tempId,
      user_id: this.state.settings.user_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.state.accounts.unshift(newAcc);
    this.saveState();

    if (this.state.isSupabaseConnected && this.supabaseClient) {
      const { data, error } = await this.supabaseClient
        .from("accounts")
        .insert({
          user_id: this.state.settings.user_id,
          name: account.name,
          google_ads_customer_id: cleanedCid,
          account_email: account.account_email,
          cash_paid_usd: account.cash_paid_usd,
          credit_offered_usd: account.credit_offered_usd,
          status: account.status,
          notes: account.notes,
        })
        .select()
        .single();

      if (data && !error) {
        // Swap temp ID with real Postgres UUID
        const idx = this.state.accounts.findIndex((a) => a.id === tempId);
        if (idx !== -1) {
          this.state.accounts[idx] = data;
          this.saveState();
        }
        return data;
      }
    }
    return newAcc;
  }

  async updateAccount(id: string, updates: Partial<Account>) {
    const index = this.state.accounts.findIndex((a) => a.id === id);
    if (index !== -1) {
      const oldStatus = this.state.accounts[index].status;
      const cleanUpdates = { ...updates };
      if (cleanUpdates.google_ads_customer_id) {
        cleanUpdates.google_ads_customer_id = normalizeCustomerId(cleanUpdates.google_ads_customer_id);
      }
      const updated = {
        ...this.state.accounts[index],
        ...cleanUpdates,
        updated_at: new Date().toISOString(),
      };
      this.state.accounts[index] = updated;

      // Status transition alerts
      if (updates.status && updates.status !== oldStatus) {
        const orders = this.state.orders.filter((o) => o.account_id === id);
        const totalSpend = orders.reduce((sum, o) => sum + (o.spend_usd || 0), 0);
        const lev = calculateRealizedLeverage(updated, totalSpend);

        if (updates.status !== "active") {
          this.addNotification({
            type: "status_change",
            title: `Account Notice: ${updated.name}`,
            message: `Status changed to ${updates.status}. Realized leverage: $${lev.realizedLeverageUsd.toFixed(
              2
            )}, Leverage lost: $${lev.leverageLostUsd.toFixed(2)}.`,
            metadata: { account_id: id, leverage_lost: lev.leverageLostUsd },
          });
        } else {
          this.addNotification({
            type: "status_change",
            title: `Account Resumed: ${updated.name}`,
            message: `Status restored to Active. Full promotional credit of $${updated.credit_offered_usd.toFixed(
              2
            )} restored.`,
            metadata: { account_id: id },
          });
        }
      }

      this.saveState();

      if (this.state.isSupabaseConnected && this.supabaseClient) {
        await this.supabaseClient
          .from("accounts")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", id);
      }
    }
  }

  async deleteAccount(id: string) {
    this.state.accounts = this.state.accounts.filter((a) => a.id !== id);
    this.state.orders = this.state.orders.filter((o) => o.account_id !== id);
    this.saveState();

    if (this.state.isSupabaseConnected && this.supabaseClient) {
      await this.supabaseClient.from("accounts").delete().eq("id", id);
    }
  }

  // --- Orders ---
  async addOrder(
    order: Omit<Order, "id" | "user_id" | "created_at" | "updated_at">
  ): Promise<Order> {
    const tempId = `ord_${Date.now()}`;
    const newOrd: Order = {
      ...order,
      id: tempId,
      user_id: this.state.settings.user_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const m = calculateOrderMetrics(
      newOrd,
      this.state.settings.alert_threshold_percent
    );
    if (m.isCompleted) {
      newOrd.status = "completed";
    } else if (m.isAlert85 && newOrd.status !== "completed") {
      newOrd.status = "alert_85";
    }

    this.state.orders.unshift(newOrd);
    this.saveState();

    if (this.state.isSupabaseConnected && this.supabaseClient) {
      let finalClientId = order.client_id;
      try {
        const { data: dbClients } = await this.supabaseClient
          .from("clients")
          .select("id")
          .eq("user_id", this.state.settings.user_id)
          .limit(1);

        if (!dbClients || dbClients.length === 0) {
          const { data: newClient } = await this.supabaseClient
            .from("clients")
            .insert({
              user_id: this.state.settings.user_id,
              name: "Direct Client",
              whatsapp_number: "+10000000000",
              notes: "Default direct client",
            })
            .select()
            .single();
          if (newClient) {
            finalClientId = newClient.id;
            this.state.clients.unshift(newClient);
          }
        } else if (!finalClientId || !finalClientId.includes("-")) {
          finalClientId = dbClients[0].id;
        }

        const { data, error } = await this.supabaseClient
          .from("orders")
          .insert({
            user_id: this.state.settings.user_id,
            account_id: order.account_id,
            client_id: finalClientId,
            date: order.date,
            video_link: order.video_link,
            video_title: order.video_title,
            order_size_views: order.order_size_views,
            client_rate_paise_per_view: order.client_rate_paise_per_view,
            delivered_views: order.delivered_views,
            spend_usd: order.spend_usd,
            campaign_id: order.campaign_id,
            status: newOrd.status,
          })
          .select()
          .single();

        if (error) {
          console.error("Supabase addOrder error:", error);
        }

        if (data && !error) {
          const idx = this.state.orders.findIndex((o) => o.id === tempId);
          if (idx !== -1) {
            this.state.orders[idx] = data;
            this.saveState();
          }
          return data;
        }
      } catch (err) {
        console.error("Supabase addOrder exception:", err);
      }
    }

    return newOrd;
  }

  async updateOrder(id: string, updates: Partial<Order>) {
    const index = this.state.orders.findIndex((o) => o.id === id);
    if (index !== -1) {
      const updated = {
        ...this.state.orders[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const m = calculateOrderMetrics(
        updated,
        this.state.settings.alert_threshold_percent
      );
      if (m.isCompleted) {
        updated.status = "completed";
      } else if (
        m.isAlert85 &&
        updated.status !== "completed" &&
        updated.status !== "paused"
      ) {
        updated.status = "alert_85";
        if (this.state.orders[index].status !== "alert_85") {
          this.addNotification({
            type: "alert_85",
            title: `PAUSE NOW! Order reached ${m.progressPercent}%`,
            message: `"${updated.video_title}" is at ${updated.delivered_views.toLocaleString()} / ${updated.order_size_views.toLocaleString()} views.`,
            metadata: { order_id: updated.id, progress: m.progressPercent },
          });
        }
      }

      this.state.orders[index] = updated;
      this.saveState();

      if (this.state.isSupabaseConnected && this.supabaseClient) {
        await this.supabaseClient
          .from("orders")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", id);
      }
    }
  }

  async deleteOrder(id: string) {
    this.state.orders = this.state.orders.filter((o) => o.id !== id);
    this.saveState();

    if (this.state.isSupabaseConnected && this.supabaseClient) {
      await this.supabaseClient.from("orders").delete().eq("id", id);
    }
  }

  // --- Clients ---
  async addClient(
    client: Omit<Client, "id" | "user_id" | "created_at">
  ): Promise<Client> {
    const tempId = `cli_${Date.now()}`;
    const newCli: Client = {
      ...client,
      id: tempId,
      user_id: this.state.settings.user_id,
      created_at: new Date().toISOString(),
    };
    this.state.clients.unshift(newCli);
    this.saveState();

    if (this.state.isSupabaseConnected && this.supabaseClient) {
      const { data, error } = await this.supabaseClient
        .from("clients")
        .insert({
          user_id: this.state.settings.user_id,
          name: client.name,
          whatsapp_number: client.whatsapp_number,
          notes: client.notes,
        })
        .select()
        .single();

      if (data && !error) {
        const idx = this.state.clients.findIndex((c) => c.id === tempId);
        if (idx !== -1) {
          this.state.clients[idx] = data;
          this.saveState();
        }
        return data;
      }
    }

    return newCli;
  }

  async updateClient(id: string, updates: Partial<Client>) {
    const index = this.state.clients.findIndex((c) => c.id === id);
    if (index !== -1) {
      this.state.clients[index] = { ...this.state.clients[index], ...updates };
      this.saveState();

      if (this.state.isSupabaseConnected && this.supabaseClient) {
        await this.supabaseClient
          .from("clients")
          .update(updates)
          .eq("id", id);
      }
    }
  }

  async deleteClient(id: string) {
    this.state.clients = this.state.clients.filter((c) => c.id !== id);
    this.saveState();

    if (this.state.isSupabaseConnected && this.supabaseClient) {
      await this.supabaseClient.from("clients").delete().eq("id", id);
    }
  }

  // --- Notifications ---
  async addNotification(
    notif: Omit<Notification, "id" | "user_id" | "read" | "created_at">
  ) {
    const newNotif: Notification = {
      ...notif,
      id: `notif_${Date.now()}`,
      user_id: this.state.settings.user_id,
      read: false,
      created_at: new Date().toISOString(),
    };
    this.state.notifications.unshift(newNotif);
    this.saveState();

    if (this.state.isSupabaseConnected && this.supabaseClient) {
      await this.supabaseClient.from("notifications").insert({
        user_id: this.state.settings.user_id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        read: false,
        metadata: notif.metadata || {},
      });
    }
  }

  async markNotificationRead(id: string) {
    const n = this.state.notifications.find((notif) => notif.id === id);
    if (n) {
      n.read = true;
      this.saveState();

      if (this.state.isSupabaseConnected && this.supabaseClient) {
        await this.supabaseClient
          .from("notifications")
          .update({ read: true })
          .eq("id", id);
      }
    }
  }

  async markAllNotificationsRead() {
    this.state.notifications.forEach((n) => (n.read = true));
    this.saveState();

    if (this.state.isSupabaseConnected && this.supabaseClient) {
      await this.supabaseClient
        .from("notifications")
        .update({ read: true })
        .eq("user_id", this.state.settings.user_id);
    }
  }

  async clearNotifications() {
    this.state.notifications = [];
    this.saveState();

    if (this.state.isSupabaseConnected && this.supabaseClient) {
      await this.supabaseClient
        .from("notifications")
        .delete()
        .eq("user_id", this.state.settings.user_id);
    }
  }

  addEmailBillingLog(
    log: Omit<EmailBillingLog, "id" | "user_id" | "created_at">
  ) {
    const newLog: EmailBillingLog = {
      ...log,
      id: `email_log_${Date.now()}`,
      user_id: this.state.settings.user_id,
      created_at: new Date().toISOString(),
    };
    this.state.emailBillingLogs.unshift(newLog);
    this.saveState();
  }

  addWhatsAppLog(log: Omit<WhatsAppLog, "id" | "user_id" | "created_at">) {
    const newLog: WhatsAppLog = {
      ...log,
      id: `wa_log_${Date.now()}`,
      user_id: this.state.settings.user_id,
      created_at: new Date().toISOString(),
    };
    this.state.whatsAppLogs.unshift(newLog);
    this.saveState();
  }

  // --- Unlinked Campaigns (Import Inbox) ---
  async addUnlinkedCampaign(
    campaign: Omit<UnlinkedCampaign, "id" | "user_id" | "created_at">
  ) {
    const newCamp: UnlinkedCampaign = {
      ...campaign,
      id: `unlinked_${Date.now()}`,
      user_id: this.state.settings.user_id,
      created_at: new Date().toISOString(),
    };
    this.state.unlinkedCampaigns = [
      newCamp,
      ...(this.state.unlinkedCampaigns || []),
    ];
    this.saveState();

    if (this.state.isSupabaseConnected && this.supabaseClient) {
      await this.supabaseClient.from("unlinked_campaigns").insert({
        user_id: this.state.settings.user_id,
        customer_id: campaign.customer_id,
        account_name: campaign.account_name,
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        cost_usd: campaign.cost_usd,
        views: campaign.views,
        status: campaign.status,
        date_range: campaign.date_range,
        detected_order_code: campaign.detected_order_code,
      });
    }
  }

  async dismissUnlinkedCampaign(id: string) {
    this.state.unlinkedCampaigns = (this.state.unlinkedCampaigns || []).filter(
      (c) => c.id !== id
    );
    this.saveState();

    if (this.state.isSupabaseConnected && this.supabaseClient) {
      await this.supabaseClient.from("unlinked_campaigns").delete().eq("id", id);
    }
  }

  async convertUnlinkedToOrder(
    unlinkedId: string,
    orderData: {
      client_id: string;
      video_title?: string;
      video_link?: string;
      order_size_views: number;
      client_rate_paise_per_view: number;
    }
  ) {
    const campaign = (this.state.unlinkedCampaigns || []).find(
      (c) => c.id === unlinkedId
    );
    if (!campaign) return;

    // Match or create account
    let targetAccount = this.state.accounts.find(
      (a) =>
        a.google_ads_customer_id.replace(/[^0-9]/g, "") ===
        campaign.customer_id.replace(/[^0-9]/g, "")
    );

    if (!targetAccount) {
      targetAccount = await this.addAccount({
        name: campaign.account_name || `Sub-Account (${campaign.customer_id})`,
        google_ads_customer_id: campaign.customer_id,
        account_email: `sub_${campaign.customer_id.replace(/[^0-9]/g, "")}@ads.mcc`,
        cash_paid_usd: 0,
        credit_offered_usd: 0,
        status: "active",
        needs_input: true,
        notes: "Auto-created during campaign conversion from Import Inbox.",
      });
    }

    const orderSize = Math.max(1, orderData.order_size_views || 100000);
    const delivered = campaign.views || 0;

    await this.addOrder({
      account_id: targetAccount.id,
      client_id: orderData.client_id,
      date: new Date().toISOString().split("T")[0],
      video_link:
        orderData.video_link || "https://www.youtube.com/watch?v=promo_video",
      video_title: orderData.video_title || campaign.campaign_name,
      order_size_views: orderSize,
      client_rate_paise_per_view: orderData.client_rate_paise_per_view,
      delivered_views: delivered,
      spend_usd: campaign.cost_usd,
      campaign_id: campaign.campaign_id,
      status: delivered >= orderSize ? "completed" : "running",
    });

    await this.dismissUnlinkedCampaign(unlinkedId);
  }

  async bulkConvertUnlinked(
    unlinkedIds: string[],
    client_id: string,
    ratePaise: number
  ) {
    for (const id of unlinkedIds) {
      const camp = (this.state.unlinkedCampaigns || []).find((c) => c.id === id);
      if (!camp) continue;

      // Smart guess order size: check 50k, 100k, 1m or default 100k
      let guessSize = 100000;
      const lower = camp.campaign_name.toLowerCase();
      if (lower.includes("50k")) guessSize = 50000;
      else if (lower.includes("200k")) guessSize = 200000;
      else if (lower.includes("500k")) guessSize = 500000;
      else if (lower.includes("1m")) guessSize = 1000000;

      await this.convertUnlinkedToOrder(id, {
        client_id,
        order_size_views: guessSize,
        client_rate_paise_per_view: ratePaise,
        video_title: camp.campaign_name,
      });
    }
  }
}

export const mockStore = new MockStore();

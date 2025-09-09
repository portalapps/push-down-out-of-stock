import { Session } from "@shopify/shopify-api";
import { SessionStorage } from "@shopify/shopify-app-remix/server";
import prisma from "./db.server";

export class CustomPrismaSessionStorage implements SessionStorage {
  constructor() {
    console.log("[DEBUG] CustomPrismaSessionStorage initialized");
  }

  async storeSession(session: Session): Promise<boolean> {
    console.log("[DEBUG] CustomPrismaSessionStorage.storeSession called for session:", session.id);
    try {
      await prisma.session.upsert({
        where: { id: session.id },
        update: {
          shop: session.shop,
          state: session.state,
          isOnline: session.isOnline,
          scope: session.scope || null,
          expires: session.expires || null,
          accessToken: session.accessToken,
          userId: session.onlineAccessInfo?.associated_user?.id || null,
          firstName: session.onlineAccessInfo?.associated_user?.first_name || null,
          lastName: session.onlineAccessInfo?.associated_user?.last_name || null,
          email: session.onlineAccessInfo?.associated_user?.email || null,
          accountOwner: session.onlineAccessInfo?.associated_user?.account_owner || false,
          locale: session.onlineAccessInfo?.associated_user?.locale || null,
          collaborator: session.onlineAccessInfo?.associated_user?.collaborator || false,
          emailVerified: session.onlineAccessInfo?.associated_user?.email_verified || false,
        },
        create: {
          id: session.id,
          shop: session.shop,
          state: session.state,
          isOnline: session.isOnline,
          scope: session.scope || null,
          expires: session.expires || null,
          accessToken: session.accessToken,
          userId: session.onlineAccessInfo?.associated_user?.id || null,
          firstName: session.onlineAccessInfo?.associated_user?.first_name || null,
          lastName: session.onlineAccessInfo?.associated_user?.last_name || null,
          email: session.onlineAccessInfo?.associated_user?.email || null,
          accountOwner: session.onlineAccessInfo?.associated_user?.account_owner || false,
          locale: session.onlineAccessInfo?.associated_user?.locale || null,
          collaborator: session.onlineAccessInfo?.associated_user?.collaborator || false,
          emailVerified: session.onlineAccessInfo?.associated_user?.email_verified || false,
        },
      });
      return true;
    } catch (error) {
      console.error("Error storing session:", error);
      return false;
    }
  }

  async loadSession(id: string): Promise<Session | undefined> {
    console.log("[DEBUG] CustomPrismaSessionStorage.loadSession called for id:", id);
    try {
      const sessionData = await prisma.session.findUnique({
        where: { id },
      });

      if (!sessionData) return undefined;

      const session = new Session({
        id: sessionData.id,
        shop: sessionData.shop,
        state: sessionData.state,
        isOnline: sessionData.isOnline,
        accessToken: sessionData.accessToken,
        scope: sessionData.scope || undefined,
        expires: sessionData.expires || undefined,
      });

      if (sessionData.userId) {
        session.onlineAccessInfo = {
          expires_in: 0,
          associated_user_scope: sessionData.scope || '',
          associated_user: {
            id: sessionData.userId,
            first_name: sessionData.firstName || '',
            last_name: sessionData.lastName || '',
            email: sessionData.email || '',
            account_owner: sessionData.accountOwner,
            locale: sessionData.locale || '',
            collaborator: sessionData.collaborator || false,
            email_verified: sessionData.emailVerified || false,
          },
        };
      }

      return session;
    } catch (error) {
      console.error("Error loading session:", error);
      return undefined;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      await prisma.session.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      console.error("Error deleting session:", error);
      return false;
    }
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    try {
      await prisma.session.deleteMany({
        where: { id: { in: ids } },
      });
      return true;
    } catch (error) {
      console.error("Error deleting sessions:", error);
      return false;
    }
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      const sessionData = await prisma.session.findMany({
        where: { shop },
      });

      return sessionData.map(data => {
        const session = new Session({
          id: data.id,
          shop: data.shop,
          state: data.state,
          isOnline: data.isOnline,
          accessToken: data.accessToken,
          scope: data.scope || undefined,
          expires: data.expires || undefined,
        });

        if (data.userId) {
          session.onlineAccessInfo = {
            expires_in: 0,
            associated_user_scope: data.scope || '',
            associated_user: {
              id: data.userId,
              first_name: data.firstName || '',
              last_name: data.lastName || '',
              email: data.email || '',
              account_owner: data.accountOwner,
              locale: data.locale || '',
              collaborator: data.collaborator || false,
              email_verified: data.emailVerified || false,
            },
          };
        }

        return session;
      });
    } catch (error) {
      console.error("Error finding sessions by shop:", error);
      return [];
    }
  }
}
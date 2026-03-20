import * as React from "react"

export function isPrototypeMode(): boolean {
  return process.env.EXPO_PUBLIC_PROTOTYPE_MODE === "true"
}

export const PROTOTYPE_SESSION = {
  session: {
    token: "prototype-session-token",
    id: "prototype-session-id",
    activeOrganizationId: "proto-org-001",
  },
  user: {
    id: "proto-user-001",
    email: "john@smithelectrical.com",
    name: "John Smith",
  },
} as const

export function getPrototypeSessionContext() {
  return PROTOTYPE_SESSION
}

interface PrototypeContextValue {
  isPrototype: true
  user: typeof PROTOTYPE_SESSION.user
  organizationId: string
}

const PrototypeContext = React.createContext<PrototypeContextValue | null>(null)

export function PrototypeProvider({ children }: { children: React.ReactNode }) {
  const value = React.useMemo<PrototypeContextValue>(
    () => ({
      isPrototype: true,
      user: PROTOTYPE_SESSION.user,
      organizationId: PROTOTYPE_SESSION.session.activeOrganizationId,
    }),
    [],
  )

  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>
}

export function usePrototype() {
  return React.useContext(PrototypeContext)
}

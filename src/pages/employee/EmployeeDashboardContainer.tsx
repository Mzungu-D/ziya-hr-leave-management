import { useCallback, useEffect, useState } from "react";

import {
  getLeaveBalances,
  listMyLeaveRequests,
} from "../../services/leave.service";

import type {
  LeaveBalance,
  LeaveRequest,
} from "../../services/leave.service";

import { EmployeeDashboard } from "./EmployeeDashboard";

import type {
  EmployeeDashboardData,
  EmployeeLeaveRequest,
  EmployeeLeaveRequestStatus,
} from "./EmployeeDashboard";

/* ============================================================
   Constants and types
============================================================ */

const EMPTY_DASHBOARD_DATA: EmployeeDashboardData = {
  leaveBalances: [],
  recentLeaveRequests: [],
  upcomingLeave: [],
  upcomingEvents: [],
  notifications: [],
};

type DashboardLoadResult = {
  balances: LeaveBalance[];
  requests: LeaveRequest[];
};

/* ============================================================
   Numeric and text normalization
============================================================ */

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function normalizeNonNegativeNumber(value: unknown): number {
  return Math.max(0, toFiniteNumber(value));
}

function normalizeStatus(
  status: string,
): EmployeeLeaveRequestStatus | null {
  switch (status.trim().toUpperCase()) {
    case "PENDING":
    case "PENDING_MANAGER":
    case "PENDING_HR":
      return "PENDING";

    case "APPROVED":
      return "APPROVED";

    case "REJECTED":
      return "REJECTED";

    case "CANCELLED":
      return "CANCELLED";

    default:
      return null;
  }
}

function formatReferenceNumber(id: string): string {
  const normalizedId = id.trim();

  if (!normalizedId) {
    return "N/A";
  }

  // This is a display fallback, not an official reference number.
  return normalizedId.slice(0, 8).toUpperCase();
}

function getLeaveTypeName(
  leaveType: LeaveBalance["leaveType"] | LeaveRequest["leaveType"],
): string {
  return leaveType?.name?.trim() || "Leave type unavailable";
}

/* ============================================================
   Date helpers
============================================================ */

function isValidDate(value: string): boolean {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Date.parse(value))
  );
}

function getStartOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function compareDatesAscending(first: string, second: string): number {
  const firstTime = Date.parse(first);
  const secondTime = Date.parse(second);

  const safeFirstTime = Number.isNaN(firstTime)
    ? Number.POSITIVE_INFINITY
    : firstTime;

  const safeSecondTime = Number.isNaN(secondTime)
    ? Number.POSITIVE_INFINITY
    : secondTime;

  return safeFirstTime - safeSecondTime;
}

function compareDatesDescending(
  first: string,
  second: string,
): number {
  const firstTime = Date.parse(first);
  const secondTime = Date.parse(second);

  const safeFirstTime = Number.isNaN(firstTime) ? 0 : firstTime;
  const safeSecondTime = Number.isNaN(secondTime) ? 0 : secondTime;

  return safeSecondTime - safeFirstTime;
}

/* ============================================================
   Leave balance mapping
============================================================ */

function mapLeaveBalance(
  balance: LeaveBalance,
): EmployeeDashboardData["leaveBalances"][number] {
  return {
    leaveTypeId: balance.leaveTypeId,
    leaveTypeName: getLeaveTypeName(balance.leaveType),
    entitledDays: normalizeNonNegativeNumber(balance.entitledDays),
    usedDays: normalizeNonNegativeNumber(balance.usedDays),
    remainingDays: normalizeNonNegativeNumber(balance.remainingDays),
  };
}

/* ============================================================
   Leave request mapping
============================================================ */

function mapLeaveRequest(
  request: LeaveRequest,
): EmployeeLeaveRequest | null {
  const status = normalizeStatus(request.status);

  // Do not misrepresent an unrecognized backend status.
  if (!status) {
    return null;
  }

  return {
    id: request.id,
    referenceNumber: formatReferenceNumber(request.id),
    leaveTypeName: getLeaveTypeName(request.leaveType),
    startDate: request.startDate,
    endDate: request.endDate,
    totalDays: normalizeNonNegativeNumber(
      request.totalDays ?? request.days,
    ),
    status,
    submittedAt: request.createdAt,
    rejectionReason:
      request.hrComments?.trim() ||
      request.managerComments?.trim() ||
      request.comments?.trim() ||
      undefined,
  };
}

/* ============================================================
   Upcoming leave
============================================================ */

function getUpcomingLeave(
  requests: EmployeeDashboardData["recentLeaveRequests"],
): EmployeeDashboardData["upcomingLeave"] {
  const today = getStartOfToday();

  return requests
    .filter((request) => {
      if (
        request.status !== "APPROVED" ||
        !isValidDate(request.startDate) ||
        !isValidDate(request.endDate)
      ) {
        return false;
      }

      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      // Exclude invalid date ranges.
      if (endDate < startDate) {
        return false;
      }

      // Include leave that is upcoming or currently in progress.
      return endDate >= today;
    })
    .map((request) => ({
      id: request.id,
      leaveTypeName: request.leaveTypeName,
      startDate: request.startDate,
      endDate: request.endDate,
      totalDays: request.totalDays,
    }))
    .sort((first, second) =>
      compareDatesAscending(first.startDate, second.startDate),
    );
}

/* ============================================================
   Recent requests
============================================================ */

function sortRecentRequests(
  requests: EmployeeDashboardData["recentLeaveRequests"],
): EmployeeDashboardData["recentLeaveRequests"] {
  return [...requests].sort((first, second) =>
    compareDatesDescending(first.submittedAt, second.submittedAt),
  );
}

/* ============================================================
   Error handling
============================================================ */

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "We couldn't load your leave dashboard. Please try again.";
}

/* ============================================================
   API loading
============================================================ */

async function loadDashboardData(
  signal: AbortSignal,
): Promise<DashboardLoadResult> {
  const [balances, requests] = await Promise.all([
    getLeaveBalances(undefined, { signal }),
    listMyLeaveRequests({ signal }),
  ]);

  if (signal.aborted) {
    throw new DOMException(
      "Dashboard request was cancelled.",
      "AbortError",
    );
  }

  if (!Array.isArray(balances) || !Array.isArray(requests)) {
    throw new Error(
      "The leave service returned an unexpected response. Please contact support if the issue continues.",
    );
  }

  return {
    balances,
    requests,
  };
}

/* ============================================================
   Employee dashboard container
============================================================ */

export function EmployeeDashboardContainer() {
  const [data, setData] =
    useState<EmployeeDashboardData>(EMPTY_DASHBOARD_DATA);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setReloadKey((currentKey) => currentKey + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    let isActive = true;

    async function fetchDashboard(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const result = await loadDashboardData(controller.signal);

        if (!isActive || controller.signal.aborted) {
          return;
        }

        const mappedBalances = result.balances.map(mapLeaveBalance);

        const mappedRequests = result.requests
          .map(mapLeaveRequest)
          .filter(
            (request): request is EmployeeLeaveRequest =>
              request !== null,
          );

        const recentLeaveRequests = sortRecentRequests(mappedRequests);

        const upcomingLeave = getUpcomingLeave(recentLeaveRequests);

        const nextData: EmployeeDashboardData = {
          leaveBalances: mappedBalances,
          recentLeaveRequests,
          upcomingLeave,

          // Do not fabricate events or notifications. Connect their
          // real API sources when those endpoints are available.
          upcomingEvents: [],
          notifications: [],
        };

        setData(nextData);
      } catch (cause: unknown) {
        if (!isActive || controller.signal.aborted) {
          return;
        }

        setError(getErrorMessage(cause));
      } finally {
        if (isActive && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void fetchDashboard();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [reloadKey]);

  return (
    <EmployeeDashboard
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={retry}
    />
  );
}

export default EmployeeDashboardContainer;

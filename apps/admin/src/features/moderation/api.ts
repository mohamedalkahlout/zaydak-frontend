import { gql } from "@/shared/api/generated"

export const ABUSIVE_REPORTS = gql(`
  query AdminAbusiveReports($model_type: String, $page: Int, $limit: Int) {
    abusiveReports(model_type: $model_type, page: $page, limit: $limit) {
      success
      data {
        id
        message
        user_id
        model_type
        model_id
        created_at
      }
      meta {
        page
        limit
        total
        total_pages
      }
    }
  }
`)

export const BECAME_SELLER_REQUESTS = gql(`
  query AdminBecameSellerRequests($status: String, $page: Int, $limit: Int) {
    becameSellerRequests(status: $status, page: $page, limit: $limit) {
      success
      data {
        id
        user_id
        status
        url
        name
        phone
        message
        created_at
        updated_at
      }
      meta {
        page
        limit
        total
        total_pages
      }
    }
  }
`)

export const APPROVE_BECAME_SELLER = gql(`
  mutation AdminApproveBecameSeller($id: String!) {
    approveBecameSeller(id: $id) {
      success
      message
      data {
        id
        status
      }
    }
  }
`)

export const REJECT_BECAME_SELLER = gql(`
  mutation AdminRejectBecameSeller($id: String!) {
    rejectBecameSeller(id: $id) {
      success
      message
      data {
        id
        status
      }
    }
  }
`)

export const AUDIT_ANOMALIES = gql(`
  query AdminAuditAnomalies($input: AuditAnomaliesInput) {
    auditAnomalies(input: $input) {
      success
      data {
        window_from
        window_to
        hours_back
        total_events
        sensitive_events_count
        top_users {
          user_id
          user_name
          action_count
        }
        spikes {
          user_id
          user_name
          recent_count
          baseline_count
          spike_ratio
        }
        sensitive_events {
          id
          user_id
          user_name
          action
          entity
          entity_id
          ip
          created_at
        }
        recent_critical {
          id
          user_id
          user_name
          action
          entity
          entity_id
          ip
          created_at
        }
      }
    }
  }
`)

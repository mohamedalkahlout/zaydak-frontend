import { gql } from "@/shared/api/generated"

/**
 * User administration operations.
 *
 * Every one of them is gated on `manage_users` (users.resolver.ts), and the
 * back-end adds a second, finer rule the UI mirrors but does not enforce: only
 * a `super_admin` may create, edit, suspend, or delete an account that is
 * itself an `admin` or `super_admin`. The console hides those actions; the
 * server is what refuses them.
 */

export const USERS = gql(`
  query AdminUsers(
    $page: Int
    $limit: Int
    $search: String
    $role: UserRole
    $status: UserStatusFilter
  ) {
    users(page: $page, limit: $limit, search: $search, role: $role, status: $status) {
      success
      data {
        id
        name
        email
        phone
        role
        permissions
        email_verified
        is_active
        deleted_at
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

export const CREATE_USER = gql(`
  mutation AdminCreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      success
      data {
        id
        name
        role
        permissions
      }
    }
  }
`)

export const ADMIN_UPDATE_USER = gql(`
  mutation AdminUpdateUser($input: AdminUpdateUserInput!) {
    adminUpdateUser(input: $input) {
      success
      data {
        id
        name
        email
        phone
        role
        email_verified
        permissions
      }
    }
  }
`)

/** Suspend (`is_active: false`) or reactivate. Reversible — not a delete. */
export const SET_USERS_ACTIVE = gql(`
  mutation AdminSetUsersActive($ids: [ID!]!, $is_active: Boolean!) {
    setUsersActive(ids: $ids, is_active: $is_active) {
      success
    }
  }
`)

export const RESTORE_USERS = gql(`
  mutation AdminRestoreUsers($ids: [ID!]!) {
    restoreUsers(ids: $ids) {
      success
    }
  }
`)

export const DELETE_USER = gql(`
  mutation AdminDeleteUser($ids: [ID!]!) {
    deleteUser(ids: $ids) {
      success
    }
  }
`)

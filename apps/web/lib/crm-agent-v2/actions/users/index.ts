import type { CrmAgentActionDefinition } from "../types";
import { permissionAssignAction } from "./permission.assign";
import { permissionRevokeAction } from "./permission.revoke";
import { permissionViewMatrixAction } from "./permission.view-matrix";
import { roleCreateAction } from "./role.create";
import { roleDeleteAction } from "./role.delete";
import { roleSearchAction } from "./role.search";
import { roleUpdateAction } from "./role.update";
import { userActivateAction } from "./user.activate";
import { userChangeOwnPasswordAction } from "./user.change-own-password";
import { userChangeRoleAction } from "./user.change-role";
import { userCreateAction } from "./user.create";
import { userDeactivateAction } from "./user.deactivate";
import { userInviteAction } from "./user.invite";
import { userLinkIdentityAction } from "./user.link-identity";
import { userResetPasswordAction } from "./user.reset-password";
import { userRevokeSessionsAction } from "./user.revoke-sessions";
import { userSearchAction } from "./user.search";
import { userUnlinkIdentityAction } from "./user.unlink-identity";
import { userUpdateEmailAction } from "./user.update-email";
import { userUpdatePhoneAction } from "./user.update-phone";
import { userUpdateProfileAction } from "./user.update-profile";
import { userViewAction } from "./user.view";

export const usersActions: CrmAgentActionDefinition[] = [
  permissionAssignAction,
  permissionRevokeAction,
  permissionViewMatrixAction,
  roleCreateAction,
  roleDeleteAction,
  roleSearchAction,
  roleUpdateAction,
  userActivateAction,
  userChangeOwnPasswordAction,
  userChangeRoleAction,
  userCreateAction,
  userDeactivateAction,
  userInviteAction,
  userLinkIdentityAction,
  userResetPasswordAction,
  userRevokeSessionsAction,
  userSearchAction,
  userUnlinkIdentityAction,
  userUpdateEmailAction,
  userUpdatePhoneAction,
  userUpdateProfileAction,
  userViewAction,
];

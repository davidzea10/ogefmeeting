import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { autorisePermission, PERMISSIONS, roleAutorise } from './permissions.js';

describe('matrice RBAC', () => {
  it('administrateur a toutes les permissions', () => {
    for (const permission of Object.values(PERMISSIONS)) {
      assert.equal(roleAutorise('administrateur', permission), true);
    }
  });

  it('lecteur peut lire mais pas créer des réunions', () => {
    assert.equal(roleAutorise('lecteur', PERMISSIONS.REUNIONS_LIRE), true);
    assert.equal(roleAutorise('lecteur', PERMISSIONS.REUNIONS_CREER), false);
  });

  it('secretaire peut démarrer une réunion mais pas valider un CR', () => {
    assert.equal(roleAutorise('secretaire', PERMISSIONS.REUNIONS_DEMARRER), true);
    assert.equal(roleAutorise('secretaire', PERMISSIONS.CR_VALIDER), false);
  });

  it('directeur peut valider un CR et consulter l’audit', () => {
    assert.equal(roleAutorise('directeur', PERMISSIONS.CR_VALIDER), true);
    assert.equal(roleAutorise('directeur', PERMISSIONS.AUDIT_LIRE), true);
  });

  it('participant peut créer/modifier (ownership côté contrôleur) mais pas archiver', () => {
    assert.equal(roleAutorise('participant', PERMISSIONS.REUNIONS_CREER), true);
    assert.equal(roleAutorise('participant', PERMISSIONS.REUNIONS_MODIFIER), true);
    assert.equal(roleAutorise('participant', PERMISSIONS.REUNIONS_ARCHIVER), false);
    assert.equal(roleAutorise('participant', PERMISSIONS.UTILISATEURS_INVITER), false);
  });

  it('seul administrateur peut inviter et gérer les directions', () => {
    assert.equal(roleAutorise('administrateur', PERMISSIONS.UTILISATEURS_INVITER), true);
    assert.equal(roleAutorise('directeur', PERMISSIONS.UTILISATEURS_INVITER), false);
    assert.equal(roleAutorise('administrateur', PERMISSIONS.DIRECTIONS_GERER), true);
    assert.equal(roleAutorise('secretaire', PERMISSIONS.DIRECTIONS_GERER), false);
  });

  it('chef de service / sous-directeur / agent (participant) peuvent créer une réunion', () => {
    assert.equal(
      autorisePermission('participant', PERMISSIONS.REUNIONS_CREER, 'chef_service'),
      true,
    );
    assert.equal(
      autorisePermission('participant', PERMISSIONS.REUNIONS_CREER, 'sous_directeur'),
      true,
    );
    // Agent (rôle participant) : création autorisée, soumise à validation.
    assert.equal(
      autorisePermission('participant', PERMISSIONS.REUNIONS_CREER, 'agent'),
      true,
    );
    assert.equal(
      autorisePermission('lecteur', PERMISSIONS.REUNIONS_CREER, 'agent'),
      false,
    );
  });
});

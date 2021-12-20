import { fakeAsync, TestBed, tick, waitForAsync } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthStateService } from '../auth-state/auth-state.service';
import { AuthStateServiceMock } from '../auth-state/auth-state.service-mock';
import { ConfigurationService } from '../config/config.service';
import { ConfigurationServiceMock } from '../config/config.service.mock';
import { OpenIdConfiguration } from '../config/openid-configuration';
import { CallbackContext } from '../flows/callback-context';
import { FlowsDataService } from '../flows/flows-data.service';
import { FlowsDataServiceMock } from '../flows/flows-data.service-mock';
import { ResetAuthDataService } from '../flows/reset-auth-data.service';
import { ResetAuthDataServiceMock } from '../flows/reset-auth-data.service-mock';
import { RefreshSessionIframeService } from '../iframe/refresh-session-iframe.service';
import { RefreshSessionIframeServiceMock } from '../iframe/refresh-session-iframe.service-mock';
import { LoggerService } from '../logging/logger.service';
import { LoggerServiceMock } from '../logging/logger.service-mock';
import { PublicEventsService } from '../public-events/public-events.service';
import { StoragePersistenceService } from '../storage/storage-persistence.service';
import { StoragePersistenceServiceMock } from '../storage/storage-persistence.service-mock';
import { UserServiceMock } from '../user-data/user-service-mock';
import { UserService } from '../user-data/user.service';
import { FlowHelper } from '../utils/flowHelper/flow-helper.service';
import { IntervalService } from './interval.service';
import { PeriodicallyTokenCheckService } from './periodically-token-check.service';
import { RefreshSessionRefreshTokenService } from './refresh-session-refresh-token.service';
import { RefreshSessionRefreshTokenServiceMock } from './refresh-session-refresh-token.service-mock';

describe('PeriodicallyTokenCheckService', () => {
  let periodicallyTokenCheckService: PeriodicallyTokenCheckService;
  let intervalService: IntervalService;
  let flowsDataService: FlowsDataService;
  let flowHelper: FlowHelper;
  let authStateService: AuthStateService;
  let refreshSessionRefreshTokenService: RefreshSessionRefreshTokenService;
  let userService: UserService;
  let storagePersistenceService: StoragePersistenceService;
  let resetAuthDataService: ResetAuthDataService;
  let configurationService: ConfigurationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: ResetAuthDataService, useClass: ResetAuthDataServiceMock },
        FlowHelper,
        { provide: FlowsDataService, useClass: FlowsDataServiceMock },
        { provide: LoggerService, useClass: LoggerServiceMock },
        { provide: UserService, useClass: UserServiceMock },
        { provide: AuthStateService, useClass: AuthStateServiceMock },
        {
          provide: RefreshSessionIframeService,
          useClass: RefreshSessionIframeServiceMock,
        },
        { provide: RefreshSessionRefreshTokenService, useClass: RefreshSessionRefreshTokenServiceMock },
        IntervalService,
        { provide: StoragePersistenceService, useClass: StoragePersistenceServiceMock },
        PublicEventsService,
        { provide: ConfigurationService, useClass: ConfigurationServiceMock },
      ],
    });
  });

  beforeEach(() => {
    periodicallyTokenCheckService = TestBed.inject(PeriodicallyTokenCheckService);
    intervalService = TestBed.inject(IntervalService);
    flowsDataService = TestBed.inject(FlowsDataService);
    flowHelper = TestBed.inject(FlowHelper);
    authStateService = TestBed.inject(AuthStateService);
    refreshSessionRefreshTokenService = TestBed.inject(RefreshSessionRefreshTokenService);
    userService = TestBed.inject(UserService);
    storagePersistenceService = TestBed.inject(StoragePersistenceService);
    resetAuthDataService = TestBed.inject(ResetAuthDataService);
    configurationService = TestBed.inject(ConfigurationService);
  });

  afterEach(() => {
    if (!!intervalService.runTokenValidationRunning?.unsubscribe) {
      intervalService.runTokenValidationRunning.unsubscribe();
      intervalService.runTokenValidationRunning = null;
    }
  });

  it('should create', () => {
    expect(periodicallyTokenCheckService).toBeTruthy();
  });

  describe('startTokenValidationPeriodically', () => {
    it(
      'returns if no config has silentrenew enabled',
      waitForAsync(() => {
        const configs = [
          { silentRenew: false, configId: 'configId1' },
          { silentRenew: false, configId: 'configId2' },
        ];

        const result = periodicallyTokenCheckService.startTokenValidationPeriodically(configs, configs[0]);

        expect(result).toBeUndefined();
      })
    );

    it(
      'returns if runTokenValidationRunning',
      waitForAsync(() => {
        const configs = [{ silentRenew: true, configId: 'configId1' }];

        spyOn(intervalService, 'isTokenValidationRunning').and.returnValue(true);

        const result = periodicallyTokenCheckService.startTokenValidationPeriodically(configs, configs[0]);

        expect(result).toBeUndefined();
      })
    );

    it('interval calls resetSilentRenewRunning when current flow is CodeFlowWithRefreshTokens', fakeAsync(() => {
      const configs = [{ silentRenew: true, configId: 'configId1', tokenRefreshInSeconds: 1 }];
      spyOn(periodicallyTokenCheckService as any, 'shouldStartPeriodicallyCheckForConfig').and.returnValue(true);
      const isCurrentFlowCodeFlowWithRefreshTokensSpy = spyOn(flowHelper, 'isCurrentFlowCodeFlowWithRefreshTokens').and.returnValue(true);
      const resetSilentRenewRunningSpy = spyOn(flowsDataService, 'resetSilentRenewRunning');
      spyOn(refreshSessionRefreshTokenService, 'refreshSessionWithRefreshTokens').and.returnValue(of({} as CallbackContext));
      spyOn(configurationService, 'getOpenIDConfiguration').and.returnValue(of(configs[0]));

      periodicallyTokenCheckService.startTokenValidationPeriodically(configs, configs[0]);

      tick(1000);

      intervalService.runTokenValidationRunning.unsubscribe();
      intervalService.runTokenValidationRunning = null;
      expect(isCurrentFlowCodeFlowWithRefreshTokensSpy).toHaveBeenCalled();
      expect(resetSilentRenewRunningSpy).toHaveBeenCalled();
    }));

    it('interval calls resetSilentRenewRunning in case of error when current flow is CodeFlowWithRefreshTokens', fakeAsync(() => {
      const configs = [{ silentRenew: true, configId: 'configId1', tokenRefreshInSeconds: 1 }];
      spyOn(intervalService, 'startPeriodicTokenCheck').and.returnValue(of(null));
      spyOn(periodicallyTokenCheckService as any, 'shouldStartPeriodicallyCheckForConfig').and.returnValue(true);
      const resetSilentRenewRunning = spyOn(flowsDataService, 'resetSilentRenewRunning');
      spyOn(flowHelper, 'isCurrentFlowCodeFlowWithRefreshTokens').and.returnValue(true);
      spyOn(refreshSessionRefreshTokenService, 'refreshSessionWithRefreshTokens').and.returnValue(throwError(() => new Error('error')));
      spyOn(configurationService, 'getOpenIDConfiguration').and.returnValue(of(configs[0]));

      periodicallyTokenCheckService.startTokenValidationPeriodically(configs, configs[0]);

      tick(1000);

      expect(periodicallyTokenCheckService.startTokenValidationPeriodically).toThrowError();
      expect(resetSilentRenewRunning).toHaveBeenCalledOnceWith(configs[0]);
    }));

    it('calls resetAuthorizationData and returns if no silent renew is configured', fakeAsync(() => {
      const configs = [{ silentRenew: true, configId: 'configId1', tokenRefreshInSeconds: 1 }];
      spyOn(periodicallyTokenCheckService as any, 'shouldStartPeriodicallyCheckForConfig').and.returnValue(true);

      const configSpy = spyOn(configurationService, 'getOpenIDConfiguration');
      const configWithoutSilentRenew = { silentRenew: false, configId: 'configId1', tokenRefreshInSeconds: 1 };
      const configWithoutSilentRenew$ = of(configWithoutSilentRenew);
      configSpy.and.returnValue(configWithoutSilentRenew$);

      const resetAuthorizationDataSpy = spyOn(resetAuthDataService, 'resetAuthorizationData');

      periodicallyTokenCheckService.startTokenValidationPeriodically(configs, configs[0]);
      tick(1000);
      intervalService.runTokenValidationRunning.unsubscribe();
      intervalService.runTokenValidationRunning = null;

      expect(resetAuthorizationDataSpy).toHaveBeenCalledTimes(1);
      expect(resetAuthorizationDataSpy).toHaveBeenCalledOnceWith(configWithoutSilentRenew, configs);
    }));

    it('calls refreshSessionWithRefreshTokens if current flow is Code flow with refresh tokens', fakeAsync(() => {
      spyOn(flowHelper, 'isCurrentFlowCodeFlowWithRefreshTokens').and.returnValue(true);
      spyOn(periodicallyTokenCheckService as any, 'shouldStartPeriodicallyCheckForConfig').and.returnValue(true);
      spyOn(storagePersistenceService, 'read').and.returnValue({});
      const configs = [{ configId: 'configId1', silentRenew: true, tokenRefreshInSeconds: 1 }];
      spyOn(configurationService, 'getOpenIDConfiguration').and.returnValue(of(configs[0] as OpenIdConfiguration));
      const refreshSessionWithRefreshTokensSpy = spyOn(
        refreshSessionRefreshTokenService,
        'refreshSessionWithRefreshTokens'
      ).and.returnValue(of({} as CallbackContext));

      periodicallyTokenCheckService.startTokenValidationPeriodically(configs, configs[0]);

      tick(1000);

      intervalService.runTokenValidationRunning.unsubscribe();
      intervalService.runTokenValidationRunning = null;
      expect(refreshSessionWithRefreshTokensSpy).toHaveBeenCalled();
    }));
  });

  describe('shouldStartPeriodicallyCheckForConfig', () => {
    it('returns false when there is no IdToken', () => {
      spyOn(authStateService, 'getIdToken').and.returnValue(null);
      spyOn(flowsDataService, 'isSilentRenewRunning').and.returnValue(false);
      spyOn(userService, 'getUserDataFromStore').and.returnValue('some-userdata');

      const result = (periodicallyTokenCheckService as any).shouldStartPeriodicallyCheckForConfig({ configId: 'configId1' });

      expect(result).toBeFalse();
    });

    it('returns false when silent renew is running', () => {
      spyOn(authStateService, 'getIdToken').and.returnValue('idToken');
      spyOn(flowsDataService, 'isSilentRenewRunning').and.returnValue(true);
      spyOn(userService, 'getUserDataFromStore').and.returnValue('some-userdata');

      const result = (periodicallyTokenCheckService as any).shouldStartPeriodicallyCheckForConfig({ configId: 'configId1' });

      expect(result).toBeFalse();
    });

    it('returns false when there is no userdata from the store', () => {
      spyOn(authStateService, 'getIdToken').and.returnValue('idToken');
      spyOn(flowsDataService, 'isSilentRenewRunning').and.returnValue(true);
      spyOn(userService, 'getUserDataFromStore').and.returnValue(null);

      const result = (periodicallyTokenCheckService as any).shouldStartPeriodicallyCheckForConfig({ configId: 'configId1' });

      expect(result).toBeFalse();
    });

    it('returns true when there is userDataFromStore, silentrenew is not running and there is an idtoken', () => {
      spyOn(authStateService, 'getIdToken').and.returnValue('idToken');
      spyOn(flowsDataService, 'isSilentRenewRunning').and.returnValue(false);
      spyOn(userService, 'getUserDataFromStore').and.returnValue('some-userdata');

      spyOn(authStateService, 'hasIdTokenExpiredAndRenewCheckIsEnabled').and.returnValue(true);
      spyOn(authStateService, 'hasAccessTokenExpiredIfExpiryExists').and.returnValue(true);

      const result = (periodicallyTokenCheckService as any).shouldStartPeriodicallyCheckForConfig({ configId: 'configId1' });

      expect(result).toBeTrue();
    });

    it('returns false if tokens are not expired', () => {
      spyOn(authStateService, 'getIdToken').and.returnValue('idToken');
      spyOn(flowsDataService, 'isSilentRenewRunning').and.returnValue(false);
      spyOn(userService, 'getUserDataFromStore').and.returnValue('some-userdata');
      spyOn(authStateService, 'hasIdTokenExpiredAndRenewCheckIsEnabled').and.returnValue(false);
      spyOn(authStateService, 'hasAccessTokenExpiredIfExpiryExists').and.returnValue(false);

      const result = (periodicallyTokenCheckService as any).shouldStartPeriodicallyCheckForConfig({ configId: 'configId1' });

      expect(result).toBeFalse();
    });

    it('returns true if tokens are  expired', () => {
      spyOn(authStateService, 'getIdToken').and.returnValue('idToken');
      spyOn(flowsDataService, 'isSilentRenewRunning').and.returnValue(false);
      spyOn(userService, 'getUserDataFromStore').and.returnValue('some-userdata');

      spyOn(authStateService, 'hasIdTokenExpiredAndRenewCheckIsEnabled').and.returnValue(true);
      spyOn(authStateService, 'hasAccessTokenExpiredIfExpiryExists').and.returnValue(true);

      const result = (periodicallyTokenCheckService as any).shouldStartPeriodicallyCheckForConfig({ configId: 'configId1' });

      expect(result).toBeTrue();
    });
  });
});

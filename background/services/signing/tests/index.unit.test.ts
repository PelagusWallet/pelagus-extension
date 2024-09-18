// import sinon from "sinon"
// import { Zone } from "quais"
// import // createKeyringService,
// // createSigningService,
// "../../../tests/factories"
// import SigningService from "../index"
//
// describe("Signing Service Unit", () => {
//   let signingService: SigningService
//   const sandbox = sinon.createSandbox()
//
//   beforeEach(async () => {
//     signingService = await createSigningService()
//     await signingService.startService()
//     sandbox.restore()
//   })
//
//   afterEach(async () => {
//     await signingService.stopService()
//   })
//
//   describe("deriveAddress", () => {
//     // TODO-DERIVATION
//     // it("should use keyring service to derive from a keyring account", async () => {
//     //   const keyringService = await createKeyringService()
//     //   const deriveAddressStub = sandbox
//     //     .stub(keyringService, "deriveAddress")
//     //     .callsFake(async () => "")
//     //
//     //   signingService = await createSigningService({
//     //     keyringService: Promise.resolve(keyringService),
//     //   })
//     //   await signingService.startService()
//     //
//     //   await signingService.deriveAddress({
//     //     type: "keyring",
//     //     keyringID: "foo",
//     //     zone: Zone.Cyprus1,
//     //   })
//     //
//     //   expect(deriveAddressStub.called).toBe(true)
//     // })
//     //
//     // it("should error when trying to derive from a read-only account", () => {
//     //   expect(
//     //     signingService.deriveAddress({
//     //       type: "read-only",
//     //     })
//     //   ).rejects.toBeTruthy()
//     // })
//   })
// })

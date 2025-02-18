/* eslint-disable comma-dangle */
/* eslint-disable no-unused-vars */
const { expect } = require('chai')
const { ethers } = require('hardhat')

const CONTRACT_NAME = 'Users'
const ADDRESS_ZERO = ethers.constants.AddressZero

const CID = 'Qmfdfxchesocnfdfrfdf54SDDFsDS'

describe('Users', function () {
  let users,
    governance,
    articles,
    reviews,
    comments,
    dev,
    owner,
    wallet1,
    wallet2,
    wallet3,
    wallet4,
    wallet5,
    wallet6

  beforeEach(async function () {
    ;[dev, owner, wallet1, wallet2, wallet3, wallet4, wallet5, wallet6] =
      await ethers.getSigners()

    const Users = await ethers.getContractFactory(CONTRACT_NAME)
    users = await Users.connect(dev).deploy(owner.address)
    await users.deployed()

    const Articles = await ethers.getContractFactory('Articles')
    articles = await Articles.connect(dev).deploy(users.address)
    await articles.deployed()

    const Reviews = await ethers.getContractFactory('Reviews')
    reviews = await Reviews.connect(dev).deploy(users.address, articles.address)
    await reviews.deployed()

    const Comments = await ethers.getContractFactory('Comments')
    comments = await Comments.connect(dev).deploy(
      users.address,
      articles.address,
      reviews.address
    )
    await comments.deployed()

    // Set contracts address
    await articles
      .connect(owner)
      .setContracts(reviews.address, comments.address)

    const Governance = await ethers.getContractFactory('Governance')
    governance = await Governance.connect(dev).deploy(
      users.address,
      articles.address,
      reviews.address,
      comments.address
    )

    // Set Contracts
    await users.connect(owner).setContracts(governance.address)
    // END OF DEPLOYMENT
  })

  describe('Deployment', function () {
    it('should asign owner as the owner', async function () {
      expect(await users.owner()).to.equal(owner.address)
    })
  })

  describe('setContracts', function () {
    it('should revert if you try call setContract a second time', async function () {
      await expect(
        users.connect(owner).setContracts(governance.address)
      ).to.be.revertedWith('Users: this function is callable only one time')
    })
    it('should revert if you are not the owner', async function () {
      await expect(
        users.connect(wallet1).setContracts(governance.address)
      ).to.be.revertedWith('Ownable')
    })
  })

  describe('Register', function () {
    let registerCall1
    beforeEach(async function () {
      registerCall1 = await users.connect(wallet1).register(CID, CID)
    })

    it('should emit a Registered event', async function () {
      expect(registerCall1)
        .to.emit(users, 'Registered')
        .withArgs(wallet1.address, 1)
    })

    it('should fill the struct properly', async function () {
      const struct = await users.userInfo(1)

      expect(struct.status, 'status').to.equal(1) // 1 = Pending
      expect(struct.profileCID, 'profileCID').to.equal(CID)
      expect(struct.nameCID, 'nameCID').to.equal(CID)
      expect(struct.walletList.length, 'nbOfWallet').to.equal(1)
      expect(struct.walletList[0], 'walletList').to.equal(wallet1.address)
    })

    it('should fill the pointer mapping', async function () {
      expect(await users.profileID(wallet1.address)).to.equal(1)
    })

    it('should increment the number of ID', async function () {
      expect(await users.nbOfUsers()).to.equal(1)
      await users.connect(wallet2).register(HASHED_PASSWORD, CID, CID)
      expect(await users.nbOfUsers()).to.equal(2)
    })

    it('should revert if wallet is already registered', async function () {
      await expect(
        users.connect(wallet1).register(CID, CID)
      ).to.be.revertedWith('Users: this wallet is already registered')
    })
  })

  describe('acceptUser', function () {
    let acceptUserCall
    beforeEach(async function () {
      await users.connect(wallet1).register(CID, CID)
      acceptUserCall = await users.connect(owner).acceptUser(1)
      await users.connect(wallet2).register(CID, CID)
    })

    it('should change the status', async function () {
      const struct = await users.userInfo(1)
      expect(struct.status).to.equal(2) // 2 = Approved
    })

    it('should change isUser boolean return when user is approved by owner', async function () {
      expect(await users.connect(wallet1).isUser(wallet2.address)).to.equal(
        false
      )
      await users.connect(wallet3).register(HASHED_PASSWORD, CID, CID)
      await users.connect(owner).acceptUser(3)
      expect(await users.connect(wallet1).isUser(wallet3.address)).to.equal(
        true
      )
    })
    it('should emit an Approved event', async function () {
      expect(acceptUserCall).to.emit(users, 'Approved').withArgs(1)
    })

    it('should revert if it not the owner', async function () {
      await expect(users.connect(wallet2).acceptUser(2)).to.be.revertedWith(
        'Ownable:'
      )
    })

    it('should revert if user is not registered', async function () {
      await expect(
        users.connect(owner).acceptUser(3),
        'not registered'
      ).to.be.revertedWith('Users: user is not registered or already approved')
    })

    it('should transfer ownership on the 5th user', async function () {
      await users.connect(wallet3).register(CID, CID)
      await users.connect(wallet4).register(CID, CID)
      await users.connect(wallet5).register(CID, CID)
      await users.connect(wallet6).register(CID, CID)
      await users.connect(owner).acceptUser(2)
      await users.connect(owner).acceptUser(3)
      await users.connect(owner).acceptUser(4)

      await users.connect(owner).acceptUser(5)

      const struct = await users.userInfo(5)
      expect(struct.status, 'change status').to.equal(2) // 1 = Pending
      expect(await users.owner(), 'address').to.equal(governance.address)
    })
  })

  describe('banUser', function () {
    let banUserCall
    beforeEach(async function () {
      await users.connect(wallet1).register(CID, CID)
      await users.connect(owner).acceptUser(1)
      banUserCall = await users.connect(owner).banUser(1)
    })

    it('should change the status', async function () {
      const struct = await users.userInfo(1)
      expect(struct.status).to.equal(0) // 0 = Not Approved
    })

    it('should change isUser boolean return when user is banned by owner', async function () {
      await users.connect(wallet2).register(HASHED_PASSWORD, CID, CID)
      await users.connect(owner).acceptUser(2)
      expect(await users.connect(wallet1).isUser(wallet2.address)).to.equal(
        true
      )
      await users.connect(owner).banUser(2)
      expect(await users.connect(wallet1).isUser(wallet2.address)).to.equal(
        false
      )
    })

    it('should emit banned user by ID', async function () {
      expect(banUserCall).to.emit(users, 'Banned').withArgs(1)
    })

    it('should revert if it not the owner', async function () {
      await expect(users.connect(wallet2).banUser(2)).to.be.revertedWith(
        'Ownable:'
      )
    })

    it('should revert if user is not registered or already banned', async function () {
      await expect(users.connect(owner).banUser(3)).to.be.revertedWith(
        'Users: user is not registered or already banned'
      )
      await expect(users.connect(owner).banUser(1)).to.be.revertedWith(
        'Users: user is not registered or already banned'
      )
    })
  })

  describe('addWallet', function () {
    let addWalletCall, walletOfUser1
    beforeEach(async function () {
      walletOfUser1 = [
        wallet1.address,
        wallet3.address,
        wallet4.address,
        wallet5.address,
        wallet6.address,
      ]
      await users.connect(wallet1).register(CID, CID)
      await users.connect(wallet2).register(CID, CID)
      await users.connect(owner).acceptUser(1)
      addWalletCall = await users.connect(wallet1).addWallet(wallet3.address)
      await users.connect(wallet1).addWallet(wallet4.address)
      await users.connect(wallet1).addWallet(wallet5.address)
      await users.connect(wallet1).addWallet(wallet6.address)
    })

    it('should add the wallet in the array', async function () {
      const struct = await users.userInfo(1)
      struct.walletList.forEach((elem, index) => {
        expect(elem, index).to.equal(walletOfUser1[index])
      })
    })

    it('should add the pointer', async function () {
      const struct = await users.userInfo(1)
      struct.walletList.forEach(async (address, index) => {
        expect(await users.profileID(address), index).to.equal(1)
      })
    })

    it('should revert if not approved', async function () {
      await expect(
        users.connect(wallet2).addWallet(wallet3.address)
      ).to.be.revertedWith('Users: you must be approved to use this feature.')
    })

    it('should revert if the added address already exist in the walletlist', async function () {
      await expect(
        users.connect(wallet1).addWallet(wallet3.address)
      ).to.be.revertedWith('Users: this wallet is already registered')
    })
  })

  describe('recoverAccount', function () {
    let recoverAccountCall
    beforeEach(async function () {
      await users.connect(wallet1).register(CID, CID)
      await users.connect(owner).acceptUser(1)
      recoverAccountCall = await users
        .connect(owner)
        .recoverAccount(1, wallet5.address)
    })

    it('should add the wallet in the list of user 1', async function () {
      const struct = await users.userInfo(1)
      expect(struct.walletList[1]).to.equal(wallet5.address)
    })

    it('should add the pointer', async function () {
      expect(await users.profileID(wallet5.address)).to.equal(1)
    })

    it('should emit a ProfileRecovered event', async function () {
      expect(recoverAccountCall)
        .to.emit(users, 'ProfileRecovered')
        .withArgs(wallet5.address, 1)
    })

    it('should revert if its not the owner', async function () {
      await expect(
        users.connect(wallet3).recoverAccount(1, wallet4.address)
      ).to.be.revertedWith('Ownable:')
    })

    it('should revert if wallet is already registered', async function () {
      await expect(
        users.connect(owner).recoverAccount(1, wallet1.address)
      ).to.be.revertedWith('Users: this wallet is already registered')
    })

    it('should revert if user is not approved', async function () {
      await expect(
        users.connect(owner).recoverAccount(3, wallet6.address)
      ).to.be.revertedWith('Users: user must be approved')
    })
  })

  describe('editProfile', function () {
    let editProfileCall
    beforeEach(async function () {
      await users.connect(wallet1).register(CID, CID)
      await users.connect(owner).acceptUser(1)
      editProfileCall = await users.connect(wallet1).editProfile('newCID')
    })

    it('should change the struct', async function () {
      const struct = await users.userInfo(1)
      expect(struct.profileCID).to.equal('newCID')
    })

    it('should emit an Edited event', async function () {
      expect(editProfileCall)
        .to.emit(users, 'Edited')
        .withArgs(wallet1.address, 1, 'newCID')
    })

    it('should revert if not registered or pending', async function () {
      await expect(
        users.connect(wallet2).editProfile('newCID')
      ).to.be.revertedWith('Users: you must be approved to use this feature.')
      await users.connect(wallet2).register(HASHED_PASSWORD, CID, CID)
      await expect(
        users.connect(wallet2).editProfile('newCID')
      ).to.be.revertedWith('Users: you must be approved to use this feature.')
    })
  })
})

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {MinimalForwarder} from "../src/MinimalForwarder.sol";
import {DAOVoting} from "../src/DAOVoting.sol";

contract DeployLocal is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        console2.log("Deploying with address:", deployer);

        vm.startBroadcast(deployerPk);

        // 1. Deploy Forwarder
        MinimalForwarder forwarder = new MinimalForwarder();
        console2.log("MinimalForwarder deployed at:", address(forwarder));

        // 2. Deploy DAO
        DAOVoting dao = new DAOVoting(address(forwarder));
        console2.log("DAOVoting deployed at:", address(dao));

        // 3. Fund DAO (Optional)
        // Check if deployer has enough funds
        if (deployer.balance >= 1 ether) {
            dao.fundDao{value: 1 ether}();
            console2.log("DAO funded with 1 Ether");
        }

        vm.stopBroadcast();
    }
}
